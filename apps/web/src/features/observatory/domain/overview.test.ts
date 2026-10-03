import { describe, expect, it } from "vitest";
import {
  breakdownCsv,
  composition,
  orderBreakdown,
  totalSchema,
  type Breakdown,
} from "./overview";
const row = (
  label: string,
  formations: number,
  capacity: number | null,
): Breakdown => ({
  label,
  formations,
  capacity: {
    value: capacity,
    observed: capacity === null ? 0 : formations,
    total: formations,
  },
  applications: { value: null, observed: 0, total: formations },
  admitted: { value: null, observed: 0, total: formations },
});
describe("observatory evidence", () => {
  it("distinguishes a published zero from no published values", () => {
    expect(
      totalSchema.safeParse({ value: 0, observed: 1, total: 3 }).success,
    ).toBe(true);
    expect(
      totalSchema.safeParse({ value: null, observed: 0, total: 3 }).success,
    ).toBe(true);
    expect(
      totalSchema.safeParse({ value: 0, observed: 0, total: 3 }).success,
    ).toBe(false);
    expect(
      totalSchema.safeParse({ value: 12, observed: 4, total: 3 }).success,
    ).toBe(false);
  });
  it("orders unknown values last while retaining observed zero and source objects", () => {
    const rows = [
      row("Absent", 2, null),
      row("Zéro", 1, 0),
      row("Grand", 3, 140),
    ];
    expect(orderBreakdown(rows, "capacity").map((r) => r.label)).toEqual([
      "Grand",
      "Zéro",
      "Absent",
    ]);
    expect(rows[0]?.label).toBe("Absent");
  });
  it("reconciles donut remainder without dropping small source categories", () => {
    const rows = [
      row("A", 4, 4),
      row("B", 3, 3),
      row("C", 2, null),
      row("D", 1, 0),
    ];
    const groups = composition(rows, 2);
    expect(groups).toEqual([
      { name: "A", value: 4, group: false },
      { name: "B", value: 3, group: false },
      { name: "Autres filières", value: 3, group: true },
    ]);
    expect(groups.reduce((sum, r) => sum + r.value, 0)).toBe(10);
  });
  it("exports selected rows, provenance and missingness without spreadsheet formulas", () => {
    const csv = breakdownCsv([row('=SUM(A1);"test"', 2, null)], 2025, {
      datasetId: "official-source",
      releaseId: "retained-release",
    });
    expect(csv).toContain('"2025";"official-source";"\'=SUM(A1);""test"""');
    expect(csv).toContain('"2";"";"0";"";"0";"";"0"');
    expect(csv).toContain('"retained-release"');
    expect(csv).toContain("non dédupliquées en personnes");
    expect(
      breakdownCsv([row("  =SUM(A1)", 1, 1)], 2025, {
        datasetId: "source",
        releaseId: "version",
      }),
    ).toContain('"\'  =SUM(A1)"');
  });
});
