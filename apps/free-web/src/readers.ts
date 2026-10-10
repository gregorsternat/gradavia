import type { PanelReaders } from "../../web/src/features/workspace/server/compose";
import { atlasResponse } from "../../web/src/features/atlas/domain/api-contract";
import {
  explorerResponse,
  detailResponse,
  formationId,
} from "../../web/src/features/formations/domain/api-contract";
import {
  overviewResponse,
  sourcesResponse,
} from "../../web/src/features/observatory/domain/overview";
import { specialtyResponse } from "../../web/src/features/specialties/domain/api-contract";
import { inverseResponse } from "../../web/src/features/specialties/domain/inverse";
import type { SearchParams } from "../../web/src/features/formations/domain/explorer";

type Fetcher = (request: Request) => Promise<Response>;
export function createReaders(fetchApi: Fetcher): PanelReaders {
  async function read<T>(
    path: string,
    schema: { parse(value: unknown): T },
    params?: SearchParams,
    keys?: string[],
  ): Promise<T | { status: "unavailable" }> {
    try {
      const url = new URL(path, "https://gradavia-api.internal");
      for (const key of keys ?? Object.keys(params ?? {})) {
        const value = params?.[key];
        const first = Array.isArray(value) ? value[0] : value;
        if (first !== undefined)
          url.searchParams.set(
            key,
            Array.from(first.trim())
              .slice(
                0,
                key === "q"
                  ? 120
                  : path === "/v1/specialties"
                    ? 1200
                    : path === "/v1/specialties/inverse"
                      ? 1600
                      : 160,
              )
              .join(""),
          );
      }
      const response = await fetchApi(
        new Request(url, { signal: AbortSignal.timeout(18_000) }),
      );
      if (response.status !== 200) return { status: "unavailable" };
      return schema.parse(await response.json());
    } catch {
      return { status: "unavailable" };
    }
  }
  return {
    loadAtlas: async (params = {}) => {
      const url = new URL("/v1/atlas", "https://gradavia-api.internal");
      for (const key of ["famille", "campagne", "version"]) {
        const raw = params[key];
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (value !== undefined)
          url.searchParams.set(key, value.trim().slice(0, 160));
      }
      try {
        const response = await fetchApi(new Request(url));
        if (response.status === 404) return { status: "not-found" };
        if (!response.ok) return { status: "unavailable" };
        return atlasResponse.parse(await response.json());
      } catch {
        return { status: "unavailable" };
      }
    },
    loadExplorer: async (params) => {
      const result = await read("/v1/formations", explorerResponse, params, [
        "campagne",
        "q",
        "type",
        "region",
        "departement",
        "statut",
        "selectivite",
        "page",
        "tri",
      ]);
      if (result.status === "ready")
        for (const values of Object.values(result.data.facets))
          values.sort((a, b) => a.localeCompare(b, "fr"));
      return result;
    },
    loadFormationSelection: async (ids) => {
      const results = [];
      for (const id of [...new Set(ids)].slice(0, 12)) {
        if (!formationId.safeParse(id).success) {
          results.push({ id, result: { status: "not-found" } as const });
          continue;
        }
        try {
          const response = await fetchApi(
            new Request(
              `https://gradavia-api.internal/v1/formations/${encodeURIComponent(id)}`,
            ),
          );
          if (
            response.status === 404 &&
            ((await response.json()) as { error?: { code?: string } }).error
              ?.code === "not_found"
          ) {
            results.push({ id, result: { status: "not-found" } as const });
            continue;
          }
          if (!response.ok) throw new Error("Unavailable");
          const result = detailResponse.parse(await response.json());
          if (result.data.formation.id !== id)
            throw new Error("Identity mismatch");
          results.push({ id, result });
        } catch {
          results.push({ id, result: { status: "unavailable" } as const });
        }
      }
      return results;
    },
    loadOverview: (campaign) =>
      read(
        "/v1/overview",
        overviewResponse,
        campaign && /^\d{4}$/.test(campaign) ? { campagne: campaign } : {},
      ),
    loadSources: () => read("/v1/sources", sourcesResponse),
    loadSpecialties: (params) =>
      read("/v1/specialties", specialtyResponse, params, ["paire", "groupe"]),
    loadInverseSpecialties: (params) =>
      read("/v1/specialties/inverse", inverseResponse, params, ["formation"]),
  };
}
