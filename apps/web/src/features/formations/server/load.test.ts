import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadExplorer, loadFormation, loadFormationSelection } from "./load";

const ready = () => ({
  status: "ready",
  data: {
    source: {
      campaign: 2025,
      releaseId: "11111111-1111-4111-8111-111111111111",
      datasetId: "fr-esr-parcoursup",
      provider: "Synthetic",
      license: "Synthetic",
      collectedAt: "2026-10-03T00:00:00Z",
      modifiedAt: null,
      fields: [],
    },
    campaigns: [2025],
    query: {
      campagne: 2025,
      q: "",
      page: 1,
      tri: "nom",
      type: "",
      region: "",
      departement: "",
      statut: "",
      selectivite: "",
    },
    facets: {
      type: [],
      region: [],
      departement: [],
      statut: [],
      selectivite: [],
    },
    formations: [],
    total: 0,
    notices: [],
  },
});

describe("formation HTTP client boundary", () => {
  beforeEach(() => {
    vi.stubEnv("ORVIO_API_URL", "http://127.0.0.1:3002");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("uses the fixed API origin, encoded inputs, no cache and a bounded signal", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(ready()));
    vi.stubGlobal("fetch", fetcher);
    expect(
      (
        await loadExplorer({
          q: "école & droit",
          campagne: "0018",
          page: "2",
          origin: "https://untrusted.test",
        })
      ).status,
    ).toBe("ready");
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url.origin).toBe("http://127.0.0.1:3002");
    expect(url.pathname).toBe("/v1/formations");
    expect(url.searchParams.get("q")).toBe("école & droit");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("campagne")).toBe("0018");
    expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  test("handles empty campaigns and rejects missing or credential-bearing configuration", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ status: "empty" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await loadExplorer({})).toEqual({ status: "empty" });
    fetcher.mockClear();
    for (const origin of [
      "",
      "postgres://user:secret@host/db",
      "https://user:secret@host",
      "https://api.test/path",
      "https://api.test/?secret=value",
    ]) {
      vi.stubEnv("ORVIO_API_URL", origin);
      expect(await loadExplorer({})).toEqual({ status: "unavailable" });
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("Formation API unavailable.");
  });

  test("maps upstream errors, malformed payloads and inconsistent pagination to retry state", async () => {
    const inconsistent = ready();
    inconsistent.data.total = 1;
    for (const response of [
      Response.json({ error: { code: "unavailable" } }, { status: 503 }),
      new Response("private upstream detail", {
        headers: { "content-type": "text/html" },
      }),
      new Response("{invalid", {
        headers: { "content-type": "application/json" },
      }),
      Response.json({ status: "ready", data: {} }),
      Response.json(inconsistent),
      new Response("x".repeat(2 * 1024 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      expect(await loadExplorer({})).toEqual({ status: "unavailable" });
    }
    for (const error of [
      new Error("secret connection detail"),
      new DOMException("deadline", "TimeoutError"),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
      expect(await loadExplorer({})).toEqual({ status: "unavailable" });
    }
    expect(
      vi
        .mocked(console.error)
        .mock.calls.every(
          (args) =>
            args.length === 1 && args[0] === "Formation API unavailable.",
        ),
    ).toBe(true);
  });
});

const detail = () => {
  const indicator = { value: 0, state: "observed", sourceField: "capa_fin" };
  const metrics = Object.fromEntries(
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
    ].map((key) => [key, indicator]),
  );
  return {
    status: "ready",
    data: {
      source: ready().data.source,
      formation: {
        id: "11111111-1111-4111-8111-111111111111:1",
        sourceFormationId: "00042",
        title: "Synthetic formation",
        establishment: null,
        city: null,
        department: null,
        region: null,
        type: null,
        status: null,
        selectivity: null,
        parcoursupUrl: null,
        metrics,
      },
      definitions: [],
      history: [],
      notices: [],
    },
  };
};

describe("formation detail HTTP boundary", () => {
  beforeEach(() => {
    vi.stubEnv("ORVIO_API_URL", "http://127.0.0.1:3002");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("rejects malformed identities without contacting upstream and distinguishes missing from unavailable", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: { code: "not_found" } }, { status: 404 }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await loadFormation("../../admin")).toEqual({ status: "not-found" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await loadFormation(detail().data.formation.id)).toEqual({
      status: "not-found",
    });
    fetcher.mockResolvedValueOnce(
      Response.json({ error: { code: "internal" } }, { status: 404 }),
    );
    expect(await loadFormation(detail().data.formation.id)).toEqual({
      status: "unavailable",
    });
  });
  test("validates both the requested identity and the published metric states", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(Response.json(detail()))),
    );
    expect((await loadFormation(detail().data.formation.id)).status).toBe(
      "ready",
    );
    expect(
      await loadFormation("11111111-1111-4111-8111-111111111111:2"),
    ).toEqual({ status: "unavailable" });
    const invalid = detail();
    invalid.data.formation.metrics.capacity = {
      value: 0,
      state: "missing",
      sourceField: "capa_fin",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(invalid)));
    expect(await loadFormation(detail().data.formation.id)).toEqual({
      status: "unavailable",
    });
  });
  test("bounds selection requests and deduplicates repeated identities", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({ error: { code: "not_found" } }, { status: 404 }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const ids = Array.from(
      { length: 20 },
      (_, index) => `11111111-1111-4111-8111-111111111111:${index + 1}`,
    );
    const result = await loadFormationSelection([ids[0]!, ...ids]);
    expect(result).toHaveLength(12);
    expect(fetcher).toHaveBeenCalledTimes(12);
    expect(result.map((row) => row.id)).toEqual(ids.slice(0, 12));
  });
});
