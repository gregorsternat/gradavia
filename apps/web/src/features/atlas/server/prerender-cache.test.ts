import { afterEach, describe, expect, it, vi } from "vitest";
import { withPrerenderAtlasCache } from "./prerender-cache";
import type { AtlasResult } from "../domain/api-contract";

const ready = {
  status: "ready",
  data: { family: "parcoursup" },
} as AtlasResult;
afterEach(() => vi.unstubAllEnvs());
describe("frozen publication atlas reads", () => {
  it("never shares reads between ordinary server requests", async () => {
    vi.stubEnv("GRADAVIA_PRERENDER", "");
    const read = vi.fn(async () => ready);
    const load = withPrerenderAtlasCache(read);
    await load("campagne=2025");
    await load("campagne=2025");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("shares concurrent frozen reads but retains only the latest exact query", async () => {
    vi.stubEnv("GRADAVIA_PRERENDER", "1");
    const read = vi.fn(async () => ready);
    const load = withPrerenderAtlasCache(read);
    const query = "famille=parcoursup&campagne=2025&version=first";
    expect(await Promise.all([load(query), load(query)])).toEqual([
      ready,
      ready,
    ]);
    expect(read).toHaveBeenCalledTimes(1);
    await load("famille=apb&campagne=2017&version=second");
    await load(query);
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("retries unavailable responses and rejected reads", async () => {
    vi.stubEnv("GRADAVIA_PRERENDER", "1");
    const read = vi
      .fn<() => Promise<AtlasResult>>()
      .mockResolvedValueOnce({ status: "unavailable" })
      .mockRejectedValueOnce(new Error("offline source unavailable"))
      .mockResolvedValue(ready);
    const load = withPrerenderAtlasCache(read);
    expect(await load("same")).toEqual({ status: "unavailable" });
    await expect(load("same")).rejects.toThrow("offline source unavailable");
    expect(await load("same")).toEqual(ready);
    expect(await load("same")).toEqual(ready);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
