import { expect, test } from "vitest";
import { explorerResponse } from "./api-contract";
import { appendFormationPage, RELEASE_CHANGED } from "./incremental";
import { parseQuery } from "./explorer";

const release = "11111111-1111-4111-8111-111111111111";
function page(number: number, version = release) {
  return {
    status: "ready" as const,
    data: {
      source: {
        campaign: 2025,
        releaseId: version,
        datasetId: "fr-esr-parcoursup",
        provider: "Synthetic",
        license: "Synthetic",
        collectedAt: "2026-10-03T00:00:00Z",
        modifiedAt: null,
        fields: [],
      },
      campaigns: [2025],
      query: parseQuery({ campagne: "2025", page: String(number) }),
      facets: {
        type: [],
        region: [],
        departement: [],
        statut: [],
        selectivite: [],
      },
      total: 31,
      notices: [],
      formations: Array.from({ length: number === 1 ? 25 : 6 }, (_, index) => ({
        id: `${version}:${(number - 1) * 25 + index + 1}`,
        title: `Formation ${index}`,
        sourceFormationId: null,
        establishment: null,
        city: null,
        department: null,
        region: null,
        type: null,
        status: null,
        selectivity: null,
        parcoursupUrl: null,
        metrics: Object.fromEntries(
          [
            "capacity",
            "applications",
            "offers",
            "admitted",
            "accessRate",
            "femaleShare",
            "scholarshipShare",
            "generalBacShare",
            "technologyBacShare",
            "vocationalBacShare",
          ].map((key) => [
            key,
            { value: 0, state: "observed", sourceField: "synthetic" },
          ]),
        ),
      })),
    },
  };
}
const first = explorerResponse.parse(page(1));
if (first.status !== "ready") throw new Error("Invalid test fixture");
const initial = first.data;

test("appends the final page without changing the initial rows or published zeros", () => {
  const result = appendFormationPage(initial, initial.formations, page(2));
  expect(result).toHaveLength(31);
  expect(result.slice(0, 25)).toEqual(initial.formations);
  expect(result[30]?.metrics.capacity.value).toBe(0);
  expect(initial.formations).toHaveLength(25);
});

test("rejects changed releases, duplicate pages, mismatched filters and malformed counts", () => {
  expect(() =>
    appendFormationPage(
      initial,
      initial.formations,
      page(2, "22222222-2222-4222-8222-222222222222"),
    ),
  ).toThrow(RELEASE_CHANGED);
  expect(() =>
    appendFormationPage(initial, initial.formations, page(1)),
  ).toThrow();
  const filtered = page(2);
  filtered.data.query.q = "other population";
  expect(() =>
    appendFormationPage(initial, initial.formations, filtered),
  ).toThrow();
  const duplicate = page(2);
  duplicate.data.formations[0]!.id = initial.formations[0]!.id;
  expect(() =>
    appendFormationPage(initial, initial.formations, duplicate),
  ).toThrow();
  const malformed = page(2);
  malformed.data.total = 32;
  expect(() =>
    appendFormationPage(initial, initial.formations, malformed),
  ).toThrow();
});

test("legacy page entry points continue from the entry page", () => {
  const entry = { ...initial, query: { ...initial.query, page: 2 }, total: 56 };
  const next = page(2);
  next.data.query.page = 3;
  next.data.total = 56;
  next.data.formations.forEach((row, index) => {
    row.id = `${release}:${51 + index}`;
  });
  expect(appendFormationPage(entry, initial.formations, next)).toHaveLength(31);
});
