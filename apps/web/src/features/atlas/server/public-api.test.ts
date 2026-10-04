import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./load", () => ({ loadAtlas: vi.fn() }));
import { serveDataset } from "./public-api";
import {
  atlasMetricKeys,
  type AtlasData,
  type AtlasResult,
} from "../domain/api-contract";
const version = "11111111-1111-4111-8111-111111111111";
const data: AtlasData = {
  source: {
    campaign: 2025,
    releaseId: version,
    datasetId: "fr-esr-parcoursup",
    provider: "Synthetic",
    license: "Synthetic",
    collectedAt: "2026-10-05T00:00:00Z",
    modifiedAt: null,
    fields: [],
  },
  family: "parcoursup",
  campaigns: [2025],
  definitions: [],
  coverage: [],
  notices: [],
  items: [
    {
      id: `${version}:1`,
      sourceFormationId: "0001",
      establishmentId: "UAI",
      title: "=SUM(A1:A2)",
      establishment: null,
      city: null,
      department: null,
      region: null,
      type: null,
      status: null,
      selectivity: null,
      latitude: null,
      longitude: null,
      metrics: Object.fromEntries(
        atlasMetricKeys.map((key) => [key, key === "capacity" ? 0 : null]),
      ) as AtlasData["items"][number]["metrics"],
      states: Object.fromEntries(
        atlasMetricKeys
          .filter((key) => key !== "capacity")
          .map((key) => [
            key,
            key === "applications" ? "suppressed" : "missing",
          ]),
      ) as AtlasData["items"][number]["states"],
    },
  ],
};
const ready = async (): Promise<AtlasResult> => ({ status: "ready", data });
const request = (query = "") =>
  new Request(`https://gradavia.com/api/v1/datasets${query}`);
describe("public dataset read boundary", () => {
  test("rejects malformed parameters before any upstream call", async () => {
    const loader = vi.fn(ready);
    for (const query of [
      "?famille=private",
      "?campagne=2025%20OR%201=1",
      "?version=no",
      "?format=sql",
      `?q=${"x".repeat(17000)}`,
    ])
      expect((await serveDataset(request(query), loader)).status).toBe(400);
    expect(loader).not.toHaveBeenCalled();
  });
  test("only verified retained snapshots receive immutable caching", async () => {
    const current = await serveDataset(request(), ready);
    expect(current.headers.get("cache-control")).toBe("no-store");
    const retained = await serveDataset(
      request(`?version=${version}&campagne=2025`),
      ready,
    );
    expect(retained.headers.get("cache-control")).toContain("immutable");
    expect(await retained.json()).toMatchObject({
      data: { source: { releaseId: version } },
    });
    const mismatch = await serveDataset(
      request("?version=22222222-2222-4222-8222-222222222222"),
      ready,
    );
    expect(mismatch.status).toBe(503);
    expect(mismatch.headers.get("cache-control")).toBe("no-store");
  });
  test("CSV preserves observed zero, suppression, provenance and formula safety", async () => {
    const response = await serveDataset(request("?format=csv"), ready);
    const text = await response.text();
    expect(text).toContain('"0";"observed";"";"suppressed"');
    expect(text).toContain('"\'=SUM(A1:A2)"');
    expect(text).toContain(version);
    expect(response.headers.get("link")).toContain("format=metadata");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const metadata = await (
      await serveDataset(request("?format=metadata"), ready)
    ).json();
    expect(metadata).toMatchObject({
      records: 1,
      source: { releaseId: version },
      snapshot: expect.stringContaining(`version=${version}`),
    });
  });
  test("preserves empty, unavailable and missing-version outcomes", async () => {
    expect(
      (await serveDataset(request(), async () => ({ status: "empty" }))).status,
    ).toBe(200);
    expect(
      (await serveDataset(request(), async () => ({ status: "unavailable" })))
        .status,
    ).toBe(503);
    expect(
      (await serveDataset(request(), async () => ({ status: "not-found" })))
        .status,
    ).toBe(404);
    const failure = await serveDataset(request(), async () => {
      throw new Error("private driver text");
    });
    expect(await failure.text()).not.toContain("private");
  });
});
