import "server-only";
import type { AtlasFamily } from "../../atlas/domain/api-contract";
import { loadAtlas } from "../../atlas/server/load";
import { formationPaths, sitemapXml } from "../domain/sitemaps";

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}

export async function formationSitemap(
  family: AtlasFamily,
  load: typeof loadAtlas = loadAtlas,
): Promise<Response> {
  const result = await load({ famille: family });
  if (result.status === "empty") return xmlResponse(sitemapXml([]));
  if (result.status !== "ready" || result.data.family !== family)
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "300",
        "X-Robots-Tag": "noindex",
      },
    });
  return xmlResponse(sitemapXml(formationPaths(result.data)));
}
