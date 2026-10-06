import { describe, expect, test } from "vitest";
import type {
  CampaignSource,
  ExplorerData,
} from "../../formations/domain/api-contract";
import { parseQuery } from "../../formations/domain/explorer";
import {
  explorerMetadata,
  pageMetadata,
  pages,
  type PublicPage,
} from "./metadata";
import {
  detailMetadata,
  detailStructuredData,
  serializeJsonLd,
} from "./structured-data";

const source: CampaignSource = {
  campaign: 2025,
  releaseId: "11111111-1111-4111-8111-111111111111",
  datasetId: "synthetic",
  provider: "Synthetic provider",
  license: "Synthetic license",
  collectedAt: "2026-10-05T00:00:00Z",
  modifiedAt: null,
  fields: [],
};
const row = {
  id: `${source.releaseId}:7`,
  title: "Licence Droit",
  establishment: "Université de démonstration",
  city: "Lyon",
  department: "Rhône",
  region: "Auvergne-Rhône-Alpes",
};
const explorer = (query = {}, campaign = 2025) =>
  explorerMetadata({
    status: "ready",
    data: {
      source: { ...source, campaign },
      campaigns: [2025, 2024],
      query: { ...parseQuery(query), campagne: campaign },
      formations: [],
      total: 51,
      facets: {
        type: [],
        region: [],
        departement: [],
        statut: [],
        selectivite: [],
      },
      notices: [],
    } satisfies ExplorerData,
  });

describe("search page identity", () => {
  test("every public route has its own description, title and production identity", () => {
    const descriptions = new Set<string>();
    for (const path of Object.keys(pages) as PublicPage[]) {
      const metadata = pageMetadata(path);
      expect(metadata.alternates?.canonical).toBe(
        `https://gradavia.com${path}`,
      );
      expect(metadata.openGraph).toMatchObject({
        url: metadata.alternates?.canonical,
        description: metadata.description,
        locale: "fr_FR",
      });
      expect(descriptions.has(metadata.description!)).toBe(false);
      descriptions.add(metadata.description!);
    }
  });

  test("tracking and presentation variants canonicalize without hiding public pages", () => {
    expect(
      pageMetadata("/carte", {
        utm_source: "newsletter",
        fbclid: "id",
        vue: "liste",
      }),
    ).toMatchObject({
      alternates: { canonical: "https://gradavia.com/carte" },
      robots: { index: true },
    });
    expect(
      pageMetadata("/carte", {
        region: "Auvergne-Rhône-Alpes",
        q: "Lyon",
        utm_source: "x",
      }),
    ).toMatchObject({
      alternates: {
        canonical:
          "https://gradavia.com/carte?q=Lyon&region=Auvergne-Rh%C3%B4ne-Alpes",
      },
      robots: { index: false, follow: true },
    });
  });

  test("personal tools stay out of results and never copy shared IDs into metadata", () => {
    for (const path of [
      "/favoris",
      "/comparer",
      "/analyses",
      "/modalites",
      "/decouvrir",
    ] as const) {
      const metadata = pageMetadata(path, {
        ids: "private-selection",
        partage: "1",
      });
      expect(metadata.robots).toMatchObject({ index: false, follow: true });
      expect(JSON.stringify(metadata)).not.toContain("private-selection");
    }
  });

  test("current campaign aliases consolidate, while other pages and historical campaigns retain identity", () => {
    expect(explorer().alternates?.canonical).toBe(
      "https://gradavia.com/formations",
    );
    expect(
      explorer({ campagne: "2025", page: "1" }).alternates?.canonical,
    ).toBe("https://gradavia.com/formations");
    expect(explorer({ page: "2" })).toMatchObject({
      title: expect.stringContaining("page 2"),
      alternates: { canonical: "https://gradavia.com/formations?page=2" },
      robots: { index: true },
    });
    expect(
      explorer({ campagne: "2024", page: "2" }, 2024).alternates?.canonical,
    ).toBe("https://gradavia.com/formations?campagne=2024&page=2");
  });

  test("search, filters, sorting and unavailable data never enter search results", () => {
    for (const params of [
      { q: "Droit" },
      { region: "Rhône" },
      { tri: "acces" },
    ])
      expect(explorer(params).robots).toMatchObject({
        index: false,
        follow: true,
      });
    for (const status of ["empty", "unavailable"] as const)
      expect(explorerMetadata({ status }).robots).toMatchObject({
        index: false,
      });
  });
});

describe("formation identity and structured data", () => {
  test("titles describe the actual establishment, place and campaign, without invented measurements", () => {
    const metadata = detailMetadata(row, source, "parcoursup");
    expect(metadata.title).toBe(
      "Licence Droit — Université de démonstration, Lyon · Parcoursup 2025",
    );
    expect(metadata.alternates?.canonical).toBe(
      `https://gradavia.com/formations/${source.releaseId}%3A7`,
    );
    const historical = detailMetadata(
      {
        ...row,
        city: null,
        establishment: null,
        department: null,
        region: null,
      },
      { ...source, campaign: 2017 },
      "apb",
    );
    expect(historical.title).toBe("Licence Droit · Archives APB 2017");
    expect(historical.description).not.toMatch(/null|taux d’accès|probabilité/);
    expect(historical.alternates?.canonical).toBe(
      `https://gradavia.com/atlas/${source.releaseId}%3A7`,
    );
  });

  test("JSON-LD cannot break out of its script and breadcrumbs retain source context", () => {
    const name = '</script><script>alert("source")</script>';
    const data = detailStructuredData(
      { ...row, title: name },
      source,
      "apprentissage",
    );
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(data);
    expect(data["@graph"][1]).toMatchObject({
      itemListElement: [
        { position: 1, item: "https://gradavia.com/" },
        {
          position: 2,
          item: "https://gradavia.com/apprentissage?campagne=2025",
        },
        {
          position: 3,
          name,
          item: `https://gradavia.com/atlas/${source.releaseId}%3A7`,
        },
      ],
    });
    expect(serialized).not.toMatch(/aggregateRating|Course|offers/);
  });
});
