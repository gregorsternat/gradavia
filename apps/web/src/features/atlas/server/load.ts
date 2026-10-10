import "server-only";
import { cache } from "react";
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
    const response = await readApi("/v1/atlas", search);
    if (response.status === 404) return { status: "not-found" };
    if (response.status !== 200) return { status: "unavailable" };
    return atlasResponse.parse(response.body);
  } catch {
    return { status: "unavailable" };
  }
}

export const loadAtlasDetail = cache(async function loadAtlasDetail(
  id: string,
): Promise<AtlasDetailResult> {
  if (!formationId.safeParse(id).success) return { status: "not-found" };
  try {
    const response = await readApi(
      `/v1/atlas/formations/${encodeURIComponent(id)}`,
    );
    if (response.status === 404) return { status: "not-found" };
    if (response.status !== 200) return { status: "unavailable" };
    const result = atlasDetailResponse.parse(response.body);
    return result.data.item.id === id ? result : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
});
