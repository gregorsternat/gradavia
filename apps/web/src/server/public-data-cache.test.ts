import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publicData } from "./public-data-cache";

const schema = z.object({ status: z.literal("ready"), value: z.number() });
const parse = (value: unknown) => schema.parse(value);
const ready = { status: "ready" as const, value: 1 };
const stored = new Map<string, Response>();
const match = vi.fn(async (request: Request) =>
  stored.get(request.url)?.clone(),
);
const put = vi.fn(async (request: Request, response: Response) => {
  stored.set(request.url, response);
});
const open = vi.fn(async () => ({ match, put }));
const load = vi.fn(async () => ready);
const read = (query = "", path = "/v1/atlas") =>
  publicData(path, new URLSearchParams(query), parse, load);

describe("public data cache", () => {
  beforeEach(() => {
    stored.clear();
    vi.clearAllMocks();
    vi.stubEnv("GRADAVIA_API_TRANSPORT", "service-binding");
    vi.stubGlobal("caches", { open });
    vi.mocked(getCloudflareContext).mockReturnValue({
      env: { GRADAVIA_API: { fetch: vi.fn() } } as unknown as CloudflareEnv,
      ctx: {},
      cf: undefined,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("expires at exactly 900 seconds even if storage returns a stale response", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    await read();
    expect(open).toHaveBeenCalledWith("gradavia-public-data-v1");
    expect([...stored.values()][0]!.headers.get("cache-control")).toBe(
      "public, max-age=900",
    );
    now.mockReturnValue(1_899_999);
    expect(await read()).toEqual(ready);
    expect(load).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1_900_000);
    expect(await read()).toEqual(ready);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("normalizes parameter ordering and isolates endpoints, campaigns, versions, families and filters", async () => {
    await read("campagne=2025&famille=parcoursup&version=one&q=école&page=1");
    await read("page=1&q=école&version=one&famille=parcoursup&campagne=2025");
    expect(load).toHaveBeenCalledTimes(1);
    for (const [key, value] of Object.entries({
      campagne: "2024",
      famille: "apprentissage",
      version: "two",
      q: "droit",
      page: "2",
    })) {
      const query = new URLSearchParams(
        "campagne=2025&famille=parcoursup&version=one&q=école&page=1",
      );
      query.set(key, value);
      await read(query.toString());
    }
    await read(
      "campagne=2025&famille=parcoursup&version=one&q=école&page=1",
      "/v1/formations",
    );
    expect(load).toHaveBeenCalledTimes(7);
  });

  test.each(["empty", "not-found", "unavailable"])(
    "does not retain %s results",
    async (status) => {
      const unavailable = vi.fn(async () => ({ status }));
      for (let i = 0; i < 2; i++)
        await publicData("/v1/atlas", undefined, parse, unavailable);
      expect(unavailable).toHaveBeenCalledTimes(2);
      expect(put).not.toHaveBeenCalled();
    },
  );

  test("revalidates cached bodies and never retains failed upstream reads", async () => {
    await read();
    const key = [...stored.keys()][0]!;
    stored.set(
      key,
      Response.json(
        { status: "ready", value: "invalid" },
        {
          headers: { "X-Gradavia-Expires": String(Date.now() + 900_000) },
        },
      ),
    );
    await read();
    expect(load).toHaveBeenCalledTimes(2);
    stored.clear();
    const failure = vi.fn(async () => {
      throw new Error("Invalid upstream contract");
    });
    await expect(
      publicData("/v1/atlas", undefined, parse, failure),
    ).rejects.toThrow("Invalid upstream contract");
    expect(stored.size).toBe(0);
    await read();
    expect(load).toHaveBeenCalledTimes(3);
  });

  test("cache failures cannot turn a successful read into a failure", async () => {
    open.mockRejectedValueOnce(new Error("Unavailable"));
    expect(await read()).toEqual(ready);
    match.mockRejectedValueOnce(new Error("Unavailable"));
    put.mockRejectedValueOnce(new Error("Full"));
    expect(await read()).toEqual(ready);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("works without Cloudflare and never caches local reads", async () => {
    vi.stubEnv("GRADAVIA_API_TRANSPORT", undefined);
    expect(await read()).toEqual(ready);
    expect(await read()).toEqual(ready);
    expect(getCloudflareContext).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    vi.stubEnv("GRADAVIA_API_TRANSPORT", "service-binding");
    vi.mocked(getCloudflareContext).mockImplementation(() => {
      throw new Error("No context");
    });
    expect(await read()).toEqual(ready);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
