import { describe, expect, it } from "vitest";
import {
  atlasMetricKeys,
  type AtlasData,
  type AtlasItem,
} from "../../atlas/domain/api-contract";
import {
  compactMatches,
  decomposition,
  matchSnapshots,
  pairedChanges,
  pairedGroups,
} from "./evolution";
const oldVersion = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  newVersion = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const row = (
  index: number,
  value: number | null,
  version = oldVersion,
  patch: Partial<AtlasItem> = {},
): AtlasItem => ({
  id: `${version}:${index}`,
  sourceFormationId: `00${index}`,
  establishmentId: "001A",
  title: `Formation ${index}`,
  establishment: "École",
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
    capacity: value,
  } as AtlasItem["metrics"],
  states: {},
  ...patch,
});
const snapshot = (
  items: AtlasItem[],
  version: string,
  campaign: number,
): AtlasData => ({
  items,
  source: {
    campaign,
    releaseId: version,
    datasetId: "source",
    provider: "MESR",
    license: "LO",
    collectedAt: "2026-10-01T00:00:00Z",
    modifiedAt: null,
    fields: [],
  },
  family: "parcoursup",
  campaigns: [2024, 2025],
  definitions: [],
  notices: [],
  coverage: [],
});
describe("conservative source-identity comparisons", () => {
  it("separates changes, ambiguity, entries, exits and incomplete identities", () => {
    const before = snapshot(
      [
        row(1, 10),
        row(2, 20),
        row(3, 30),
        row(4, 40),
        row(5, 50, oldVersion, { sourceFormationId: null }),
      ],
      oldVersion,
      2024,
    );
    const after = snapshot(
      [
        row(1, 12, newVersion),
        row(2, 22, newVersion, { title: "New description" }),
        row(3, 35, newVersion),
        row(6, 99, newVersion, { sourceFormationId: "003" }),
        row(7, 3, newVersion),
      ],
      newVersion,
      2025,
    );
    const result = matchSnapshots(before, after);
    expect(result.matched).toHaveLength(1);
    expect([...result.beforeGroups.values()].sort()).toEqual([
      "ambiguous",
      "changed",
      "exited",
      "matched",
      "unidentified",
    ]);
    expect(result.afterGroups.get(`${newVersion}:7`)).toBe("entered");
    const contributions = decomposition(before, after, result, "capacity");
    expect(
      contributions.reduce((sum, part) => sum + (part.delta ?? 0), 0),
    ).toBe(171 - 150);
    expect(() => matchSnapshots(before, { ...after, family: "apb" })).toThrow();
  });
  it("requires unchanged location and status, not just source identity", () => {
    const before = snapshot([row(1, 10), row(2, 20)], oldVersion, 2024);
    const after = snapshot(
      [
        row(1, 12, newVersion, { status: "Private" }),
        row(2, 22, newVersion, { city: "Other" }),
      ],
      newVersion,
      2025,
    );
    expect(matchSnapshots(before, after).matched).toHaveLength(0);
  });
  it("ranks on identical observed pairs, keeps ties and excludes missing values", () => {
    const before = snapshot(
      [row(1, 10), row(2, 10), row(3, 0), row(4, null)],
      oldVersion,
      2024,
    );
    const after = snapshot(
      [
        row(1, 20, newVersion),
        row(2, 5, newVersion),
        row(3, 3, newVersion),
        row(4, 100, newVersion),
      ],
      newVersion,
      2025,
    );
    const pairs = pairedChanges(
      compactMatches(matchSnapshots(before, after).matched),
      "capacity",
    );
    expect(pairs).toHaveLength(3);
    expect(
      pairs.find((pair) => pair.before.id === `${oldVersion}:1`)?.beforeRank,
    ).toBe(1);
    expect(
      pairs.find((pair) => pair.before.id === `${oldVersion}:2`)?.beforeRank,
    ).toBe(1);
    expect(
      pairs.find((pair) => pair.before.id === `${oldVersion}:3`)?.beforeRank,
    ).toBe(3);
    expect(
      pairs.find((pair) => pair.before.id === `${oldVersion}:3`)?.index,
    ).toBeNull();
    expect(pairedGroups(pairs, "type", true)[0]?.current).toBe(140);
  });
  it("distinguishes a missing cohort from an existing unobserved metric", () => {
    const before = snapshot([row(1, null)], oldVersion, 2024),
      after = snapshot([], newVersion, 2025);
    const parts = decomposition(
      before,
      after,
      matchSnapshots(before, after),
      "capacity",
    );
    expect(parts.find((part) => part.cohort === "exited")?.delta).toBeNull();
    expect(parts.find((part) => part.cohort === "entered")?.delta).toBe(0);
  });
});
