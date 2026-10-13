import "server-only";
import { loadAtlas, loadAtlasDetail } from "../../atlas/server/load";
import { peerSummary } from "../../atlas/domain/exploration";
import { formationId } from "../domain/api-contract";
import type { FormationInsightsResult } from "../domain/insights";

export async function loadFormationInsights(
  id: string,
): Promise<FormationInsightsResult> {
  if (!formationId.safeParse(id).success) return { status: "not-found" };
  const detail = await loadAtlasDetail(id);
  if (detail.status !== "ready") return detail;
  const { source, family, item } = detail.data;
  const atlas = await loadAtlas({
    campagne: String(source.campaign),
    famille: family,
    version: source.releaseId,
  });
  if (
    atlas.status !== "ready" ||
    atlas.data.source.releaseId !== source.releaseId ||
    atlas.data.source.campaign !== source.campaign ||
    atlas.data.family !== family
  )
    return { status: "unavailable" };
  return {
    status: "ready",
    data: { detail: detail.data, peers: peerSummary(atlas.data.items, item) },
  };
}
