import { describe, expect, test } from "vitest";
import {
  inverseCsv,
  inverseResponse,
  inverseUrl,
  type InverseData,
} from "./inverse";
const release = "11111111-1111-4111-8111-111111111111";
const observation = (value: number | null) => ({
  value,
  state: value === null ? ("suppressed" as const) : ("observed" as const),
  sourceField: "published",
});
const formation = {
  id: JSON.stringify(["BUT", "BUT - Informatique"]),
  group: "BUT",
  label: "BUT - Informatique",
};
const data: InverseData = {
  source: {
    campaign: 2025,
    releaseId: release,
    datasetId: "specialties",
    provider: "MESR",
    license: "Licence ouverte",
    collectedAt: "2026-01-01T00:00:00Z",
    modifiedAt: null,
    fields: [],
  },
  query: { formation: formation.id },
  formations: [formation],
  rows: [
    {
      id: `${release}:1`,
      group: formation.group,
      formation: formation.label,
      pair: {
        id: '["Mathématiques","NSI"]',
        label: "Mathématiques + NSI",
        specialties: ["Mathématiques", "NSI"],
      },
      applications: observation(150),
      offers: observation(0),
      accepted: observation(null),
    },
  ],
  notices: [],
  requestNotices: [],
};

describe("inverse specialties", () => {
  test("validates the release and exact national group/label, preserving metric states", () => {
    expect(inverseResponse.parse({ status: "ready", data }).status).toBe(
      "ready",
    );
    for (const invalid of [
      { ...data, query: { formation: "other" } },
      { ...data, rows: [{ ...data.rows[0]!, group: "Licence" }] },
      {
        ...data,
        rows: [
          { ...data.rows[0]!, id: "22222222-2222-4222-8222-222222222222:1" },
        ],
      },
      { ...data, rows: [...data.rows, ...data.rows] },
    ])
      expect(
        inverseResponse.safeParse({ status: "ready", data: invalid }).success,
      ).toBe(false);
  });
  test("exports exact counts, suppression and source identities without aggregate estimates", () => {
    const csv = inverseCsv(data);
    expect(csv).toContain('"150";"observed";"0";"observed";"";"suppressed"');
    expect(csv).toContain(`"specialties";"${release}";"${release}:1"`);
    expect(csv.trim().split(/\r?\n/)).toHaveLength(2);
    const url = new URL(
      inverseUrl(formation.id, "offers"),
      "https://gradavia.com",
    );
    expect(url.searchParams.get("formation")).toBe(formation.id);
    expect(url.searchParams.get("tri")).toBe("offers");
  });
});
