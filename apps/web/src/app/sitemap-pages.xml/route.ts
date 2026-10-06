import { publicPagePaths, sitemapXml } from "@/features/seo/domain/sitemaps";
import { xmlResponse } from "@/features/seo/server/sitemaps";

export const dynamic = "force-static";
export function GET() {
  return xmlResponse(sitemapXml(publicPagePaths()));
}
