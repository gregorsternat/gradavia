import { canonicalHref } from "../../workspace/domain/registry";
import type { AtlasData } from "../../atlas/domain/api-contract";
import { absoluteUrl, pages } from "./metadata";
import { detailPath } from "./structured-data";

export const sitemapPaths = [
  "/sitemap-pages.xml",
  "/sitemap-formations.xml",
  "/sitemap-apprentissage.xml",
  "/sitemap-apb.xml",
];

function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}

export function sitemapXml(paths: string[], index = false): string {
  if (paths.length > 50_000) throw new Error("Sitemap exceeds URL limit");
  const root = index ? "sitemapindex" : "urlset";
  const child = index ? "sitemap" : "url";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `<${child}><loc>${escapeXml(absoluteUrl(path))}</loc></${child}>`).join("\n")}\n</${root}>`;
}

export function publicPagePaths(): string[] {
  return Object.entries(pages)
    .filter(([, page]) => !("noIndex" in page && page.noIndex))
    .map(([path]) => canonicalHref(path));
}

export function formationPaths(data: AtlasData): string[] {
  // One validated, complete immutable snapshot. Never fabricate row numbers.
  return data.items.map((item) => detailPath(item.id, data.family));
}
