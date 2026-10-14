import "server-only";
import {
  getCloudflareContext,
  type CloudflareContext,
} from "@opennextjs/cloudflare";

const CACHE_NAME = "gradavia-public-data-v1";
const TTL_SECONDS = 900;
const EXPIRES_HEADER = "X-Gradavia-Expires";

/** Cache only validated public data. The transport and local reads stay unchanged. */
export async function publicData<T extends { status: string }>(
  path: string,
  params: URLSearchParams | undefined,
  parse: (body: unknown) => T,
  load: () => Promise<T>,
  refresh = false,
): Promise<T> {
  let storage: Cache | undefined;
  let context: CloudflareContext | undefined;
  const key = new URL(path, "https://gradavia.com");
  key.pathname = `/__public-data/v1${key.pathname}`;
  const query = new URLSearchParams(params);
  query.sort();
  key.search = query.toString();
  const request = new Request(key);
  // Named Cache API is local to each Cloudflare location, with no storage binding.
  // Never turn a local or misconfigured runtime into a shared caching transport.
  if (process.env.GRADAVIA_API_TRANSPORT === "service-binding") {
    try {
      context = getCloudflareContext();
      if (context.env.GRADAVIA_API && typeof caches !== "undefined") {
        storage = await caches.open(CACHE_NAME);
        const hit = refresh ? undefined : await storage.match(request);
        if (hit) {
          const expires = Number(hit.headers.get(EXPIRES_HEADER));
          if (Number.isFinite(expires) && expires > Date.now()) {
            const result = parse(await hit.json());
            if (result.status === "ready") return result;
          } else {
            // Cancelling a cloned stream can wait for its other branch. It must
            // not delay the normal read when a cache returns an expired entry.
            const discard = hit.body?.cancel().catch(() => {});
            if (discard && context.ctx?.waitUntil)
              context.ctx.waitUntil(discard);
          }
        }
      }
    } catch {
      // Expired, invalid or inaccessible cache entries are ordinary misses.
    }
  }
  const result = await load();
  if (storage && result.status === "ready") {
    try {
      // Use the parsed result, never an unchecked upstream body or error response.
      const response = Response.json(result, {
        headers: {
          "Cache-Control": `public, max-age=${TTL_SECONDS}`,
          [EXPIRES_HEADER]: String(Date.now() + TTL_SECONDS * 1000),
        },
      });
      const write = storage.put(request, response).catch(() => {});
      if (context?.ctx?.waitUntil) context.ctx.waitUntil(write);
      else await write;
    } catch {
      // Cache capacity and availability must not affect successful public reads.
    }
  }
  return result;
}
