import "server-only";
import { publicData } from "../../../server/public-data-cache";
import { readApi } from "@/features/formations/server/load";
import {
  overviewResponse,
  sourcesResponse,
  type OverviewResult,
} from "../domain/overview";

export async function loadOverview(campaign?: string): Promise<OverviewResult> {
  try {
    const params = new URLSearchParams();
    if (campaign && /^\d{4}$/.test(campaign)) params.set("campagne", campaign);
    return await publicData<OverviewResult>(
      "/v1/overview",
      params,
      (body) => overviewResponse.parse(body),
      async () => {
        const response = await readApi("/v1/overview", params);
        if (response.status !== 200) return { status: "unavailable" };
        return overviewResponse.parse(response.body);
      },
    );
  } catch {
    return { status: "unavailable" };
  }
}

export async function loadSources(): Promise<
  import("../domain/overview").SourcesResult
> {
  try {
    return await publicData<import("../domain/overview").SourcesResult>(
      "/v1/sources",
      undefined,
      (body) => sourcesResponse.parse(body),
      async () => {
        const response = await readApi("/v1/sources");
        if (response.status !== 200) return { status: "unavailable" };
        return sourcesResponse.parse(response.body);
      },
    );
  } catch {
    return { status: "unavailable" };
  }
}
