import "server-only";
import { cache } from "react";
import { loadAtlas } from "@/features/atlas/server/load";
import { fold } from "@/features/atlas/domain/exploration";
import type { AtlasData } from "@/features/atlas/domain/api-contract";
import { formationId } from "@/features/formations/domain/api-contract";
import {
  loadExplorer,
  loadFormationSelection,
} from "@/features/formations/server/load";
import {
  FAVORITES_PAGE_SIZE,
  MAX_FAVORITES,
  parseSelectionIds,
} from "@/features/formations/domain/selection";
import { loadOverview, loadSources } from "@/features/observatory/server/load";
import { loadSpecialties } from "@/features/specialties/server/load";
import { loadInverseSpecialties } from "@/features/specialties/server/inverse";
import { prepareEvolution } from "@/features/evolution/domain/evolution";
import { sourceQuiz } from "@/features/discovery/domain/quiz";
import { panelParams, type PanelId } from "../domain/registry";

async function modalities(raw: Record<string, string>) {
  const params = Object.fromEntries(
    ["classique", "apprenti", "q_classique", "q_apprenti", "campagne"].map(
      (key) => [key, (raw[key] ?? "").slice(0, 160)],
    ),
  );
  const classicId = formationId.safeParse(params.classique).success
    ? params.classique!
    : "";
  const apprenticeId = formationId.safeParse(params.apprenti).success
    ? params.apprenti!
    : "";
  const classic = await loadAtlas({
    famille: "parcoursup",
    ...(classicId ? { version: classicId.split(":")[0] } : {}),
    ...(params.campagne ? { campagne: params.campagne } : {}),
  });
  if (classic.status !== "ready") return { status: classic.status } as const;
  const apprentice = await loadAtlas({
    famille: "apprentissage",
    campagne: String(classic.data.source.campaign),
    ...(apprenticeId ? { version: apprenticeId.split(":")[0] } : {}),
  });
  if (apprentice.status !== "ready")
    return { status: apprentice.status } as const;
  if (apprentice.data.source.campaign !== classic.data.source.campaign)
    return { status: "empty" } as const;
  const choice = (data: AtlasData, id: string, q: string) => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const matches = data.items.filter((row) =>
      terms.every((term) =>
        fold(
          `${row.title} ${row.establishment ?? ""} ${row.city ?? ""}`,
        ).includes(term),
      ),
    );
    return {
      source: data.source,
      selected: data.items.find((row) => row.id === id) ?? null,
      candidates: matches.slice(0, 8),
      total: matches.length,
      q,
    };
  };
  return {
    status: "ready",
    classic: choice(classic.data, classicId, params.q_classique ?? ""),
    apprentice: choice(apprentice.data, apprenticeId, params.q_apprenti ?? ""),
    params: {
      ...params,
      classique: classicId,
      apprenti: apprenticeId,
      campagne: String(classic.data.source.campaign),
    },
  } as const;
}
async function evolution(params: Record<string, string>) {
  const after = await loadAtlas({
    famille: params.famille,
    campagne: params.fin,
    version: params.version_fin,
  });
  if (after.status !== "ready") return { status: after.status } as const;
  const priorYear = [...after.data.campaigns]
    .filter((year) => year < after.data.source.campaign)
    .sort((a, b) => b - a)[0];
  const firstYear =
    params.debut ?? (priorYear === undefined ? undefined : String(priorYear));
  if (!firstYear) return { status: "empty" } as const;
  const before = await loadAtlas({
    famille: after.data.family,
    campagne: firstYear,
    version: params.version_debut,
  });
  if (before.status !== "ready") return { status: before.status } as const;
  if (before.data.source.campaign === after.data.source.campaign)
    return { status: "empty" } as const;
  return {
    status: "ready",
    data: prepareEvolution(before.data, after.data),
  } as const;
}
/** Shared by initial SSR and the allowlisted, same-origin panel reader. */
export const loadPanel = cache(async (panel: PanelId, search: string) => {
  const params = Object.fromEntries(
    panelParams(panel, new URLSearchParams(search)),
  );
  switch (panel) {
    case "formations":
      return {
        kind: "formations",
        result: await loadExplorer(params),
      } as const;
    case "carte":
    case "apprentissage":
    case "apprentissage-carte":
    case "archives":
    case "analyses":
      return {
        kind: "atlas",
        result: await loadAtlas({
          ...params,
          famille: params.famille ?? "parcoursup",
        }),
      } as const;
    case "overview":
    case "territoires":
      return {
        kind: "overview",
        result: await loadOverview(params.campagne),
      } as const;
    case "sources":
    case "donnees":
      return { kind: "sources", result: await loadSources() } as const;
    case "specialites":
      return {
        kind: "specialites",
        result: await loadSpecialties(params),
      } as const;
    case "inverse":
      return {
        kind: "inverse",
        result: await loadInverseSpecialties(params),
      } as const;
    case "selection":
      return {
        kind: "selection",
        results: await loadFormationSelection(parseSelectionIds(params.ids)),
      } as const;
    case "favoris": {
      const shared = params.partage === "1";
      const ids = parseSelectionIds(
        params.ids,
        shared ? MAX_FAVORITES : FAVORITES_PAGE_SIZE,
      );
      const results = [];
      for (let offset = 0; offset < ids.length; offset += FAVORITES_PAGE_SIZE)
        results.push(
          ...(await loadFormationSelection(
            ids.slice(offset, offset + FAVORITES_PAGE_SIZE),
          )),
        );
      return { kind: "favoris", results } as const;
    }
    case "budget":
      return { kind: "budget" } as const;
    case "modalites":
      return { kind: "modalites", result: await modalities(params) } as const;
    case "evolutions":
      return { kind: "evolutions", result: await evolution(params) } as const;
    case "decouvrir": {
      const result = await loadAtlas({
        campagne: params.campagne,
        version: params.version,
        famille: "parcoursup",
      });
      return {
        kind: "decouvrir",
        result:
          result.status === "ready"
            ? {
                status: "ready",
                questions: sourceQuiz(result.data),
                source: result.data.source,
              }
            : result,
      } as const;
    }
  }
});
export type PanelPayload = Awaited<ReturnType<typeof loadPanel>>;
