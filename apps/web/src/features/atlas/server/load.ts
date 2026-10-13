import "server-only";
import { cache } from "react";
import { publicData } from "../../../server/public-data-cache";
import { readApi } from "@/features/formations/server/load";
import { formationId } from "@/features/formations/domain/api-contract";
import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  atlasResponse,
  atlasDetailResponse,
  type AtlasResult,
  type AtlasDetailResult,
} from "../domain/api-contract";

export async function loadAtlas(
  params: SearchParams = {},
): Promise<AtlasResult> {
  try {
    const search = new URLSearchParams();
    for (const key of ["campagne", "famille", "version"]) {
      const raw = params[key];
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value !== undefined) search.set(key, value.trim().slice(0, 160));
    }
    const parse = (body: unknown) => {
      const result = atlasResponse.parse(body);
      if (
        result.status === "ready" &&
        search.has("version") &&
        result.data.source.releaseId !== search.get("version")
      )
        throw new Error("Inconsistent snapshot version");
      return result;
    };
    return await publicData<AtlasResult>(
      "/v1/atlas",
      search,
      parse,
      async () => {
        const response = await readApi("/v1/atlas", search);
        if (response.status === 404) return { status: "not-found" };
        if (response.status !== 200) return { status: "unavailable" };
        return parse(response.body);
      },
    );
  } catch {
    return { status: "unavailable" };
  }
}

export const loadAtlasDetail = cache(async function loadAtlasDetail(
  id: string,
): Promise<AtlasDetailResult> {
  if (!formationId.safeParse(id).success) return { status: "not-found" };
  try {
    const path = `/v1/atlas/formations/${encodeURIComponent(id)}`;
    const parse = (body: unknown) => {
      const result = atlasDetailResponse.parse(body);
      if (result.data.item.id !== id)
        throw new Error("Inconsistent detail identity");
      return result;
    };
    return await publicData<AtlasDetailResult>(
      path,
      undefined,
      parse,
      async () => {
        const response = await readApi(path);
        if (response.status === 404) return { status: "not-found" };
        if (response.status !== 200) return { status: "unavailable" };
        return parse(response.body);
      },
    );
  } catch {
    return { status: "unavailable" };
  }
});
