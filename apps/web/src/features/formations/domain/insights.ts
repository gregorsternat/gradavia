import type { AtlasDetail } from "../../atlas/domain/api-contract";
import type { peerSummary } from "../../atlas/domain/exploration";

export type FormationInsightsResult =
  | {
      status: "ready";
      data: { detail: AtlasDetail; peers: ReturnType<typeof peerSummary> };
    }
  | { status: "unavailable" | "not-found" };
