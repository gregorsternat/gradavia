import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/features/seo/domain/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dev/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
