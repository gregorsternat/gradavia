import {
  canonicalHref,
  resolvePanel,
  isPanel,
} from "../../web/src/features/workspace/domain/registry";
import { createPanelLoader } from "../../web/src/features/workspace/server/compose";
import { createReaders } from "./readers";
import { dataset, staticPanel } from "./static-readers";
import { pageAsset, pageIdentity } from "./identity";

type Fetcher = { fetch(request: Request): Promise<Response> };
export type Environment = { PUBLICATION: Fetcher; GRADAVIA_API: Fetcher };
const error = (status: number, code: string) =>
  Response.json(
    { error: { code } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        ...(status === 503 ? { "retry-after": "5" } : {}),
      },
    },
  );
async function asset(env: Environment, path: string) {
  return env.PUBLICATION.fetch(
    new Request(`https://publication.internal/${path}`),
  );
}
const contentTypes: Record<string, string> = {
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  css: "text/css",
  js: "application/javascript",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
  woff2: "font/woff2",
};
function cached(request: Request, response: Response, headers: Headers) {
  const etag = response.headers.get("etag");
  if (etag) headers.set("etag", etag);
  const match = request.headers
    .get("if-none-match")
    ?.split(",")
    .map((value) => value.trim().replace(/^W\//, ""));
  const unchanged =
    response.ok && etag && (match?.includes(etag) || match?.includes("*"));
  if (unchanged || request.method === "HEAD") {
    void response.body?.cancel();
    if (unchanged) headers.delete("content-length");
    return new Response(null, {
      status: unchanged ? 304 : response.status,
      headers,
    });
  }
  return new Response(response.body, { status: response.status, headers });
}
export async function handle(
  request: Request,
  env: Environment,
): Promise<Response> {
  if (!["GET", "HEAD"].includes(request.method))
    return error(405, "method_not_allowed");
  const url = new URL(request.url);
  if (url.hostname === "www.gradavia.com") {
    url.hostname = "gradavia.com";
    return Response.redirect(url.toString(), 308);
  }
  const canonical = canonicalHref(url.pathname + url.search);
  if (canonical !== url.pathname + url.search)
    return new Response(null, {
      status: 308,
      headers: { location: canonical },
    });
  if (
    url.pathname === "/" &&
    /^\d{4}$/.test(url.searchParams.get("campagne") ?? "")
  )
    return new Response(null, {
      status: 307,
      headers: {
        location: `/observatoire?campagne=${url.searchParams.get("campagne")}`,
      },
    });
  if (url.pathname === "/api/health") return Response.json({ status: "ok" });
  if (url.pathname === "/api/v1/datasets") return dataset(request, env);
  if (url.pathname.startsWith("/api/workspace/")) {
    const panel = url.pathname.slice("/api/workspace/".length);
    if (!isPanel(panel)) return error(404, "not_found");
    if (url.search.length > 16_384) return error(400, "invalid_query");
    const prepared = await staticPanel(panel, url.searchParams, env);
    if (prepared) {
      const headers = new Headers(prepared.headers);
      headers.set("cache-control", "private, no-store");
      headers.set("x-robots-tag", "noindex");
      return new Response(request.method === "HEAD" ? null : prepared.body, {
        status: prepared.status,
        headers,
      });
    }
    const load = createPanelLoader(
      createReaders((r) => env.GRADAVIA_API.fetch(r)),
    );
    const payload = await load(panel, url.searchParams.toString());
    return new Response(
      request.method === "HEAD" ? null : JSON.stringify(payload),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "private, no-store",
          "x-robots-tag": "noindex",
        },
      },
    );
  }
  if (url.pathname.startsWith("/api/")) return error(404, "not_found");
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(xml|txt|svg|png|jpg|jpeg|webp|ico|woff2)$/.test(url.pathname) ||
    url.pathname === "/opengraph-image"
  ) {
    const response = await asset(env, `public${url.pathname}`);
    const headers = new Headers(response.headers);
    const type = url.pathname.includes("opengraph")
      ? "image/png"
      : contentTypes[url.pathname.split(".").at(-1)!];
    if (type) headers.set("content-type", type);
    headers.set(
      "cache-control",
      response.ok && url.pathname.startsWith("/_next/static/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=0, must-revalidate",
    );
    headers.set("x-content-type-options", "nosniff");
    return cached(request, response, headers);
  }
  const rsc = request.headers.get("rsc") === "1";
  const path = pageIdentity(url.pathname + url.search);
  let response = await asset(env, await pageAsset(path, rsc));
  let fallback = false;
  if (response.status === 404) {
    const panel = resolvePanel(url.pathname, url.searchParams);
    if (!panel) {
      const missing = await asset(
        env,
        `pages/not-found.${rsc ? "rsc" : "html"}`,
      );
      return new Response(request.method === "HEAD" ? null : missing.body, {
        status: 404,
        headers: {
          "content-type": rsc ? "text/x-component" : "text/html; charset=utf-8",
          "x-robots-tag": "noindex",
        },
      });
    }
    response = await asset(env, `shells/${panel}.${rsc ? "rsc" : "html"}`);
    fallback = true;
  }
  if (!response.ok) return error(503, "unavailable");
  const headers = new Headers({
    "content-type": rsc ? "text/x-component" : "text/html; charset=utf-8",
    "cache-control": "public, max-age=0, must-revalidate",
    vary: "RSC",
    "x-content-type-options": "nosniff",
  });
  if (fallback) headers.set("x-robots-tag", "noindex, follow");
  return cached(request, response, headers);
}
