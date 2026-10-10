import type { AtlasResult } from "../domain/api-contract";

/** The offline renderer reads one frozen publication for its entire process. */
export function withPrerenderAtlasCache(
  read: (query: string) => Promise<AtlasResult>,
) {
  let current: { query: string; result: Promise<AtlasResult> } | undefined;
  return async (query: string): Promise<AtlasResult> => {
    // Normal server requests must retain their existing freshness behavior.
    if (process.env.GRADAVIA_PRERENDER !== "1") return read(query);
    if (current?.query === query) return current.result;
    const entry = { query, result: read(query) };
    current = entry;
    try {
      const result = await entry.result;
      if (result.status !== "ready" && current === entry) current = undefined;
      return result;
    } catch (error) {
      if (current === entry) current = undefined;
      throw error;
    }
  };
}
