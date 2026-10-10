import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Readable } from "node:stream";
import { handle } from "../apps/free-web/src/handler";
import { startPublicationApi } from "./runtime";
import { validatePublication, readArtifact } from "./publication-assets";
const root = resolve(
  process.argv[2] ??
    process.env.PUBLICATION_DIR ??
    (await readFile(".artifacts/publication-fixture-path", "utf8")).trim(),
);
const manifest = await validatePublication(root);
const port = Number(
  process.env.PUBLICATION_PREVIEW_PORT ?? process.env.E2E_PORT ?? "3581",
);
const api = await startPublicationApi(root, join(root, ".."));
const env = {
  PUBLICATION: {
    async fetch(request: Request) {
      const name = new URL(request.url).pathname.slice(1);
      if (!manifest.files[name] && !manifest.files[`${name}.parts.json`])
        return new Response("Not found", { status: 404 });
      try {
        return new Response(new Uint8Array(await readArtifact(root, name)));
      } catch {
        return new Response("Unavailable", { status: 503 });
      }
    },
  },
  GRADAVIA_API: {
    fetch(request: Request) {
      const url = new URL(request.url);
      url.host = new URL(api.url).host;
      url.protocol = "http:";
      return fetch(new Request(url, request));
    },
  },
};
const server = createServer(async (req, res) => {
  try {
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
    });
    const response = await handle(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body)
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ).pipe(res);
    else res.end();
  } catch {
    res.writeHead(503);
    res.end("Publication unavailable");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Publication preview: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    void api.stop().then(() => process.exit());
  });
