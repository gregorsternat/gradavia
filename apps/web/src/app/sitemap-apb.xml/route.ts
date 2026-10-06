import { formationSitemap } from "@/features/seo/server/sitemaps";

export const dynamic = "force-dynamic";
export function GET() {
  return formationSitemap("apb");
}
