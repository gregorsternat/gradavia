import { describe, expect, it } from "vitest";
import {
  atlasMetricKeys,
  type AtlasData,
  type AtlasItem,
} from "../../atlas/domain/api-contract";
import { sourceQuiz } from "./quiz";

const version = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const record = (
  id: number,
  capacity: number | null,
  type: string,
): AtlasItem => ({
  id: `${version}:${id}`,
  sourceFormationId: String(id),
  establishmentId: "001A",
  title: type,
  establishment: "École",
  city: "Ville",
  region: "Nord",
  department: "Département",
  type,
  status: "Public",
  selectivity: null,
  latitude: null,
  longitude: null,
  metrics: {
    ...Object.fromEntries(atlasMetricKeys.map((key) => [key, null])),
    capacity,
  } as AtlasItem["metrics"],
  states: capacity === null ? { capacity: "suppressed" } : {},
});
const data: AtlasData = {
  source: {
    campaign: 2025,
    releaseId: version,
    datasetId: "source",
    provider: "MESR",
    license: "LO",
    collectedAt: "2026-10-01T00:00:00Z",
    modifiedAt: null,
    fields: [],
  },
  items: [
    record(1, 0, "Licence"),
    record(2, 30, "Licence"),
    record(3, null, "BTS"),
  ],
  family: "parcoursup",
  campaigns: [2025],
  definitions: [],
  coverage: [],
  notices: [],
};
describe("source-backed discovery questions", () => {
  it("uses record denominators and observed capacities without imputing missing values", () => {
    const questions = sourceQuiz(data);
    expect(questions).toHaveLength(3);
    expect(questions[0]?.answer).toBeCloseTo(200 / 3);
    expect(questions[1]?.answer).toBe(100);
    expect(questions[1]?.values[0]?.count).toBe(30);
    expect(questions[2]?.answer).toBeCloseTo(200 / 3);
    expect(
      questions[2]?.values.find((value) => value.label === "Masquées")?.count,
    ).toBe(1);
    expect(
      questions.every((question) => question.analysis.includes(version)),
    ).toBe(true);
  });
  it("omits capacity shares when the observed total is zero and handles empty data", () => {
    expect(
      sourceQuiz({ ...data, items: [record(1, 0, "Licence")] }).map(
        (question) => question.id,
      ),
    ).toEqual(["formations", "coverage"]);
    expect(sourceQuiz({ ...data, items: [] })).toEqual([]);
  });
});
