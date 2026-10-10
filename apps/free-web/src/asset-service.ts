/** Private immutable archive reader. Both index and range reads use bound assets. */
type Fetcher = { fetch(request: Request): Promise<Response> };
type Env = { SHARDS: string; [binding: string]: string | Fetcher };
type Entry = {
  pack: string;
  offset: number;
  bytes: number;
  sha256: string;
  packBytes: number;
  br?: Entry;
};
function acceptsBrotli(header: string | null) {
  const codings = (header ?? "")
    .toLowerCase()
    .split(",")
    .map((part) => {
      const [name, ...parameters] = part.trim().split(";");
      const quality = parameters
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return {
        name: name?.trim(),
        quality:
          quality === undefined
            ? 1
            : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality)
              ? Number(quality)
              : 0,
      };
    });
  return (
    ((
      codings.find((c) => c.name === "br") ??
      codings.find((c) => c.name === "*")
    )?.quality ?? 0) > 0
  );
}
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
async function file(env: Env, name: string, headers?: HeadersInit) {
  const shards = JSON.parse(env.SHARDS) as {
    binding: string;
    first: string;
    last: string;
  }[];
  const shard = shards.find((s) => name >= s.first && name <= s.last);
  if (!shard) return new Response(null, { status: 404 });
  return (env[shard.binding] as Fetcher).fetch(
    new Request(`https://assets.internal/${name}`, { headers }),
  );
}
export async function readAsset(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname.slice(1);
  if (!path || path.length > 512 || !["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 404 });
  const key = await hash(path);
  const index = await file(env, `lookup/${key.slice(0, 3)}.json`);
  if (!index.ok) return new Response(null, { status: index.status });
  const original = ((await index.json()) as Record<string, Entry>)[key];
  if (!original) return new Response(null, { status: 404 });
  const encoded =
    !!original.br && acceptsBrotli(request.headers.get("accept-encoding"));
  const entry = encoded ? original.br! : original;
  if (
    !Number.isSafeInteger(entry.offset) ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.offset < 0 ||
    entry.bytes <= 0
  )
    return new Response(null, { status: 503 });
  const response = await file(env, entry.pack, {
    range: `bytes=${entry.offset}-${entry.offset + entry.bytes - 1}`,
  });
  let body = response.body;
  if (response.status === 206) {
    if (
      response.headers.get("content-range")?.split("/")[0] !==
      `bytes ${entry.offset}-${entry.offset + entry.bytes - 1}`
    )
      return new Response(null, { status: 503 });
  } else if (response.status === 200 && body) {
    const total = entry.packBytes;
    if (entry.offset !== 0 || entry.bytes !== total) {
      // Static asset bindings currently ignore Range. Small packs bound cold
      // slicing work; objects above this budget always occupy their own pack.
      if (
        !Number.isSafeInteger(total) ||
        total > 256 * 1024 ||
        entry.offset + entry.bytes > total
      )
        return new Response(null, { status: 503 });
      const reader = body.getReader();
      let position = 0;
      body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          for (;;) {
            const next = await reader.read();
            if (next.done) {
              controller.error(new Error("Truncated archive"));
              return;
            }
            const start = Math.max(0, entry.offset - position);
            const end = Math.min(
              next.value.byteLength,
              entry.offset + entry.bytes - position,
            );
            position += next.value.byteLength;
            if (end > start)
              controller.enqueue(next.value.subarray(start, end));
            if (position >= entry.offset + entry.bytes) {
              controller.close();
              await reader.cancel();
              return;
            }
            if (end > start) return;
          }
        },
        cancel(reason) {
          return reader.cancel(reason);
        },
      });
    }
  } else return new Response(null, { status: 503 });
  const init = {
    headers: {
      etag: `"${entry.sha256}"`,
      "content-length": String(entry.bytes),
      "content-type": path.endsWith(".json")
        ? "application/json"
        : "application/octet-stream",
      ...(encoded ? { "content-encoding": "br" } : {}),
    },
    ...(encoded ? { encodeBody: "manual" as const } : {}),
  };
  return new Response(request.method === "HEAD" ? null : body, init);
}
// Large logical objects have <= 4 chunks. Return a stream without buffering it.
const assetService = {
  async fetch(request: Request, env: Env) {
    let response = await readAsset(request, env);
    if (response.status !== 404) return response;
    const url = new URL(request.url);
    url.pathname += ".parts.json";
    response = await readAsset(new Request(url), env);
    if (!response.ok) return response;
    const meta = (await response.json()) as { parts: string[]; sha256: string };
    if (!Array.isArray(meta.parts) || meta.parts.length > 4)
      return new Response(null, { status: 503 });
    let index = 0;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        for (;;) {
          if (!reader) {
            if (index === meta.parts.length) {
              controller.close();
              return;
            }
            const part = meta.parts[index++]!;
            if (
              !part.startsWith(
                `${new URL(request.url).pathname.slice(1)}.parts/`,
              )
            ) {
              controller.error(new Error("Invalid part"));
              return;
            }
            const response = await readAsset(
              new Request(`https://publication.internal/${part}`),
              env,
            );
            if (!response.ok || !response.body) {
              controller.error(new Error("Missing part"));
              return;
            }
            reader = response.body.getReader();
          }
          const next = await reader.read();
          if (next.done) {
            reader = undefined;
            continue;
          }
          controller.enqueue(next.value);
          return;
        }
      },
      cancel(reason) {
        return reader?.cancel(reason);
      },
    });
    return new Response(request.method === "HEAD" ? null : body, {
      headers: {
        etag: `"${meta.sha256}"`,
        "content-type": new URL(request.url).pathname.endsWith(".json")
          ? "application/json"
          : "application/octet-stream",
      },
    });
  },
};

export default assetService;
