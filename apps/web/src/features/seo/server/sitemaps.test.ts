import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../atlas/server/load", () => ({ loadAtlas: vi.fn() }));
import type {
  AtlasData,
  AtlasFamily,
  AtlasResult,
} from "../../atlas/domain/api-contract";
import { formationSitemap } from "./sitemaps";
import { publicPagePaths, sitemapPaths, sitemapXml } from "../domain/sitemaps";

const version = "11111111-1111-4111-8111-111111111111";
function snapshot(family: AtlasFamily, count = 2): AtlasData {
  return {
    family,
    source: {
      campaign: family === "apb" ? 2017 : 2025,
      releaseId: version,
      datasetId: "synthetic",
      provider: "Synthetic provider",
      license: "Synthetic license",
      collectedAt: "2026-10-05T00:00:00Z",
      modifiedAt: null,
      fields: [],
    },
    campaigns: [family === "apb" ? 2017 : 2025],
    items: Array.from({ length: count }, (_, index) => ({
      id: `${version}:${index * 2 + 1}`,
      sourceFormationId: null,
      establishmentId: null,
      title: "Synthetic formation",
      establishment: null,
      city: null,
      department: null,
      region: null,
      type: null,
      status: null,
      selectivity: null,
      latitude: null,
      longitude: null,
      metrics: {
        capacity: 0,
        applications: 0,
        offers: 0,
        admitted: 0,
        accessRate: 0,
        femaleShare: 0,
        scholarshipShare: 0,
        generalBacShare: 0,
        technologyBacShare: 0,
        vocationalBacShare: 0,
        localShare: 0,
      },
      states: {},
    })),
    definitions: [],
    coverage: [],
    notices: [],
  };
}

describe("complete source-owned sitemaps", () => {
  test("index and public pages contain only canonical production documents, without invented update dates", () => {
    const index = sitemapXml(sitemapPaths, true);
    expect(index).toContain("<sitemapindex");
    expect(index.match(/<loc>/g)).toHaveLength(4);
    const xml = sitemapXml(publicPagePaths());
    for (const excluded of [
      "/favoris</loc>",
      "/comparer",
      "/analyses",
      "/dev/",
      "/api/",
      "lastmod",
      "changefreq",
      "priority",
      "localhost",
    ])
      expect(xml).not.toContain(excluded);
    expect(sitemapXml(["/formations?q=a&campagne=2024"])).toContain(
      "q=a&amp;campagne=2024",
    );
    expect(() => sitemapXml(Array(50_001).fill("/"))).toThrow(
      "Sitemap exceeds URL limit",
    );
  });

  test("each family uses one complete snapshot and the same canonical detail path as metadata", async () => {
    for (const family of ["parcoursup", "apprentissage", "apb"] as const) {
      const load = vi.fn(async (): Promise<AtlasResult> => ({
        status: "ready",
        data: snapshot(family),
      }));
      const response = await formationSitemap(family, load);
      expect(load).toHaveBeenCalledExactlyOnceWith({ famille: family });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/xml");
      const xml = await response.text();
      expect(xml.match(/<loc>/g)).toHaveLength(2);
      expect(xml).toContain(
        `https://gradavia.com/${family === "parcoursup" ? "formations" : "atlas"}/${version}%3A3`,
      );
      expect(xml).not.toContain(`${version}%3A2`);
    }
  });

  test("the entire 30,000-row contract fits one sitemap without sampling", async () => {
    const response = await formationSitemap("parcoursup", async () => ({
      status: "ready",
      data: snapshot("parcoursup", 30_000),
    }));
    const xml = await response.text();
    expect(xml.match(/<loc>/g)).toHaveLength(30_000);
    expect(xml).toContain(`${version}%3A59999`);
    expect(new TextEncoder().encode(xml).length).toBeLessThan(50 * 1024 * 1024);
  });

  test("transient failures cannot publish a misleading empty sitemap or be cached", async () => {
    for (const status of ["unavailable", "not-found"] as const) {
      const response = await formationSitemap("parcoursup", async () => ({
        status,
      }));
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBe("300");
      expect(await response.text()).not.toContain("<urlset");
    }
    const mismatch = await formationSitemap("parcoursup", async () => ({
      status: "ready",
      data: snapshot("apb"),
    }));
    expect(mismatch.status).toBe(503);
    const empty = await formationSitemap("parcoursup", async () => ({
      status: "empty",
    }));
    expect(empty.status).toBe(200);
    expect(await empty.text()).toContain("<urlset");
  });
});
