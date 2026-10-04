import { describe, expect, it } from "vitest";
import {
  atlasMetricKeys,
  type AtlasData,
  type AtlasItem,
} from "../../atlas/domain/api-contract";
import {
  aggregate,
  analysisHref,
  defaultConfig,
  distribution,
  filterItems,
  grouped,
  matrix,
  measureValue,
  parseSavedViews,
  quality,
  readConfig,
} from "./analysis";
import { analysisCsv, analysisExport, analysisSvg, csvCell } from "./export";

const version = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function row(
  index: number,
  capacity: number | null,
  applications: number | null,
  patch: Partial<AtlasItem> = {},
): AtlasItem {
  return {
    id: `${version}:${index}`,
    sourceFormationId: `00${index}`,
    establishmentId: "001A",
    title: `Formation ${index}`,
    establishment: "École de l’Œuvre",
    city: "Ville",
    department: "Département",
    region: "Nord",
    type: "BTS",
    status: "Public",
    selectivity: "Sélective",
    latitude: null,
    longitude: null,
    metrics: {
      ...Object.fromEntries(atlasMetricKeys.map((key) => [key, null])),
      capacity,
      applications,
    } as AtlasItem["metrics"],
    states: {
      ...Object.fromEntries(
        atlasMetricKeys
          .filter((key) => key !== "capacity" && key !== "applications")
          .map((key) => [key, "missing"]),
      ),
      ...(capacity === null ? { capacity: "missing" as const } : {}),
      ...(applications === null ? { applications: "suppressed" as const } : {}),
    },
    ...patch,
  };
}
const rows = [
  row(1, 10, 100),
  row(2, 0, 8),
  row(3, null, 20),
  row(4, 90, null),
  row(5, 20, 0),
];
const data: AtlasData = {
  source: {
    campaign: 2025,
    releaseId: version,
    datasetId: "official-source",
    provider: "MESR",
    license: "Licence Ouverte",
    collectedAt: "2026-10-01T00:00:00Z",
    modifiedAt: null,
    fields: ["capa_fin", "voe_tot"],
  },
  family: "parcoursup",
  campaigns: [2025],
  items: rows,
  coverage: quality(rows),
  definitions: [
    {
      key: "capacity",
      field: "capa_fin",
      label: "Places",
      unit: "count",
      description: "Capacité publiée, pas de places vacantes.",
    },
  ],
  notices: [],
};

describe("analysis populations and statistics", () => {
  it("retains observed zero, source multiplicity and partial-sum coverage", () => {
    expect(aggregate(rows, "capacity")).toEqual({
      value: 120,
      observed: 4,
      total: 5,
      method: "sum",
    });
    expect(aggregate([row(1, null, null)], "capacity").value).toBeNull();
    expect(aggregate([row(1, 0, 0)], "capacity").value).toBe(0);
    expect(aggregate([rows[0]!, rows[0]!], "records").value).toBe(2);
  });
  it("uses paired observed rows with positive capacity for demand ratios", () => {
    expect(aggregate(rows, "pressure")).toEqual({
      value: 100 / 30,
      observed: 2,
      total: 5,
      method: "paired-ratio",
    });
    expect(measureValue(rows[1]!, "pressure")).toBeNull();
    expect(measureValue(rows[4]!, "pressure")).toBe(0);
  });
  it("reports an unweighted formation median, never an average rate", () => {
    const rates = [1, 10, 100].map((rate, index) => {
      const item = row(index + 1, 50, 100);
      item.metrics.accessRate = rate;
      delete item.states.accessRate;
      return item;
    });
    expect(aggregate(rates, "accessRate")).toEqual({
      value: 10,
      observed: 3,
      total: 3,
      method: "median",
    });
    expect(grouped(rates, "region", "accessRate")[0]?.share).toBeNull();
  });
  it("counts every observed value once across histogram boundaries", () => {
    const items = Array.from({ length: 13 }, (_, i) =>
      row(i + 1, i * 10, null),
    );
    const stats = distribution(items, "capacity");
    expect(stats.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(13);
    expect(stats.bins[0]?.start).toBe(0);
    expect(stats.bins.at(-1)?.end).toBe(120);
    expect(stats.median).toBe(60);
    expect(stats.q1).toBe(30);
    expect(stats.q3).toBe(90);
    expect(distribution([row(1, 0, 0), row(2, 0, 0)], "capacity").bins).toEqual(
      [{ index: 0, start: 0, end: 0, count: 2, last: true }],
    );
  });
  it("flags distant observations without treating missing values as zero", () => {
    const stats = distribution(
      [1, 2, 3, 4, 100, null].map((value, i) => row(i + 1, value, null)),
      "capacity",
    );
    expect(stats.outliers.map((item) => item.id)).toEqual([`${version}:5`]);
    expect(stats.missing).toBe(1);
    expect(distribution([], "capacity").median).toBeNull();
  });
  it("keeps exact source categories, accent-folded AND search, and inclusive bounds", () => {
    const config = {
      ...defaultConfig,
      region: ["Nord"],
      type: "BTS",
      search: "ecole oeuvre",
      minimum: 0,
      maximum: 10,
    };
    expect(filterItems(rows, config).map((item) => item.id)).toEqual([
      `${version}:1`,
      `${version}:2`,
    ]);
    expect(filterItems(rows, { ...config, type: "BUT" })).toHaveLength(0);
  });
  it("reconciles groups, cross-tab cells and additive shares", () => {
    const items = [
      row(1, 10, 100),
      row(2, 20, 100, { region: "Sud", type: "Licence" }),
      row(3, null, null, { region: null }),
    ];
    const groups = grouped(items, "region", "capacity");
    expect(groups.reduce((sum, group) => sum + group.total, 0)).toBe(3);
    expect(
      groups.reduce((sum, group) => sum + (group.share ?? 0), 0),
    ).toBeCloseTo(100);
    expect(
      matrix(items, "region", "type", "capacity").reduce(
        (sum, cell) => sum + (cell.value ?? 0),
        0,
      ),
    ).toBe(30);
    expect(groups.at(-1)?.label).toBe("Non renseigné");
  });
  it("preserves suppressed, missing, invalid and observed coverage", () => {
    const invalid = row(6, null, null);
    invalid.states.capacity = "invalid";
    expect(
      quality([...rows, invalid]).find((item) => item.key === "capacity"),
    ).toEqual({
      key: "capacity",
      observed: 4,
      missing: 1,
      suppressed: 0,
      invalid: 1,
    });
    expect(
      quality(rows).find((item) => item.key === "applications")?.suppressed,
    ).toBe(1);
  });
});
describe("reproducible analysis and exports", () => {
  it("round-trips bounded settings, annotations and multiple regions with immutable provenance", () => {
    const config = {
      ...defaultConfig,
      region: ["Nord", "Sud"],
      annotation: "<Constat & source>",
      minimum: 0,
      maximum: 100,
      view: "matrix" as const,
      mode: "share" as const,
    };
    const href = analysisHref(config, data);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(readConfig(params)).toEqual(config);
    expect(params.get("version")).toBe(version);
    expect(params.get("campagne")).toBe("2025");
    expect(params.get("famille")).toBe("parcoursup");
  });
  it("rejects unsupported URL settings and disallows shares of percentages", () => {
    const config = readConfig(
      new URLSearchParams(
        "vue=invalid&x=invalid&indicateur=accessRate&mode=share&min=Infinity&max=-1",
      ),
    );
    expect(config.view).toBe("scatter");
    expect(config.x).toBe("capacity");
    expect(config.mode).toBe("count");
    expect(config.minimum).toBeNull();
    expect(config.maximum).toBeNull();
    const reversed = readConfig(new URLSearchParams("min=10&max=5"));
    expect(reversed.minimum).toBe(10);
    expect(reversed.maximum).toBe(5);
    expect(filterItems(rows, reversed)).toEqual([]);
  });
  it("validates local saved views and rejects external or invalid storage data", () => {
    expect(parseSavedViews(null)).toEqual([]);
    expect(() => parseSavedViews("invalid")).toThrow();
    expect(() =>
      parseSavedViews(
        JSON.stringify([
          {
            name: "View",
            href: "https://example.org",
            savedAt: "2026-10-01T00:00:00Z",
          },
        ]),
      ),
    ).toThrow();
    expect(
      parseSavedViews(
        JSON.stringify([
          {
            name: "View",
            href: analysisHref(defaultConfig, data),
            savedAt: "2026-10-01T00:00:00Z",
          },
        ]),
      ),
    ).toHaveLength(1);
  });
  it("exports full missingness, definitions and source even for an empty cohort", () => {
    const exported = analysisExport(data, rows, defaultConfig);
    expect(exported.records[3]?.states.applications).toBe("suppressed");
    expect(exported.definitions[0]?.field).toBe("capa_fin");
    const csv = analysisCsv(data, [], defaultConfig);
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain('"metadata"');
    expect(csv).toContain("selectedRowCount");
    expect(csv).toContain(version);
    expect(csv).toContain("capa_fin");
  });
  it("neutralizes formulas and quotes source text without erasing an observed zero", () => {
    expect(csvCell("  =SUM(A1)")).toBe('"\'  =SUM(A1)"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(null)).toBe('""');
    expect(
      analysisCsv(data, [row(1, 0, null, { title: "=1+1" })], defaultConfig),
    ).toContain('"\'=1+1"');
  });
  it("escapes SVG annotations and retains all source records in metadata", () => {
    const svg = analysisSvg(data, rows, {
      ...defaultConfig,
      annotation: '<script>alert("unsafe")</script>',
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain(version);
    expect(svg).toContain("suppressed");
    expect(svg).toContain("<circle");
  });
});
