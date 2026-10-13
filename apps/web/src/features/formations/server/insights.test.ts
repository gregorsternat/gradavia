import { beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../atlas/server/load", () => ({
  loadAtlas: vi.fn(),
  loadAtlasDetail: vi.fn(),
}));
import { loadAtlas, loadAtlasDetail } from "../../atlas/server/load";
import { loadFormationInsights } from "./insights";
import type { AtlasDetail, AtlasData } from "../../atlas/domain/api-contract";

const releaseId = "11111111-1111-4111-8111-111111111111";
const id = `${releaseId}:1`;
const source = {
  campaign: 2025,
  releaseId,
  datasetId: "synthetic",
  provider: "Synthetic",
  license: "Synthetic",
  collectedAt: "2026-10-01T00:00:00Z",
  modifiedAt: null,
  fields: [],
};
const detail: AtlasDetail = {
  source,
  family: "parcoursup",
  metrics: {},
  definitions: [],
  rankGroups: [],
  history: [],
  notices: [],
  item: {
    id,
    title: "Licence informatique",
    type: "Licence",
    selectivity: "Non sélective",
    sourceFormationId: "1",
    establishmentId: null,
    establishment: null,
    city: null,
    department: null,
    region: null,
    status: null,
    latitude: null,
    longitude: null,
    metrics: {
      capacity: 100,
      applications: 1000,
      offers: 300,
      admitted: 100,
      accessRate: 50,
      femaleShare: 50,
      scholarshipShare: 30,
      generalBacShare: 80,
      technologyBacShare: 15,
      vocationalBacShare: 5,
      localShare: 60,
    },
    states: {},
  },
};
const atlas: AtlasData = {
  source,
  family: "parcoursup",
  campaigns: [2025],
  definitions: [],
  coverage: [],
  notices: [],
  items: [detail.item, { ...detail.item, id: `${releaseId}:2` }],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadAtlasDetail).mockResolvedValue({
    status: "ready",
    data: detail,
  });
  vi.mocked(loadAtlas).mockResolvedValue({ status: "ready", data: atlas });
});
test("rejects invalid identifiers before making a read", async () => {
  expect(await loadFormationInsights("invalid")).toEqual({
    status: "not-found",
  });
  expect(loadAtlasDetail).not.toHaveBeenCalled();
  expect(loadAtlas).not.toHaveBeenCalled();
});
test("returns compact peers pinned to the detail's exact source", async () => {
  const result = await loadFormationInsights(id);
  expect(loadAtlas).toHaveBeenCalledExactlyOnceWith({
    campagne: "2025",
    famille: "parcoursup",
    version: releaseId,
  });
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("Expected ready insights");
  expect(Object.keys(result.data)).toEqual(["detail", "peers"]);
  expect(result.data.peers.count).toBe(1);
  expect(result.data.peers.alternatives.map((row) => row.id)).toEqual([
    `${releaseId}:2`,
  ]);
});
test.each([
  { ...atlas, family: "apb" as const },
  { ...atlas, source: { ...source, campaign: 2024 } },
  {
    ...atlas,
    source: { ...source, releaseId: "22222222-2222-4222-8222-222222222222" },
  },
])("never combines a mismatched peer snapshot", async (data) => {
  vi.mocked(loadAtlas).mockResolvedValue({ status: "ready", data });
  expect(await loadFormationInsights(id)).toEqual({ status: "unavailable" });
});
test("keeps failures retryable and does not load an atlas for a missing detail", async () => {
  vi.mocked(loadAtlasDetail).mockResolvedValueOnce({ status: "not-found" });
  expect(await loadFormationInsights(id)).toEqual({ status: "not-found" });
  expect(loadAtlas).not.toHaveBeenCalled();
  vi.mocked(loadAtlas).mockResolvedValueOnce({ status: "unavailable" });
  expect(await loadFormationInsights(id)).toEqual({ status: "unavailable" });
  expect((await loadFormationInsights(id)).status).toBe("ready");
});
