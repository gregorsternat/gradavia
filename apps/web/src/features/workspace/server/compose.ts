import type { AtlasData } from "../../atlas/domain/api-contract";
import { fold } from "../../atlas/domain/exploration";
import { formationId } from "../../formations/domain/api-contract";
import {
  FAVORITES_PAGE_SIZE,
  MAX_FAVORITES,
  parseSelectionIds,
} from "../../formations/domain/selection";
import { prepareEvolution } from "../../evolution/domain/evolution";
import { sourceQuiz } from "../../discovery/domain/quiz";
import { panelParams, paramRecord, type PanelId } from "../domain/registry";
import type {
  SearchParams,
  ExplorerResult,
} from "../../formations/domain/explorer";
import type { AtlasResult } from "../../atlas/domain/api-contract";
import type { DetailResult } from "../../formations/domain/api-contract";
import type {
  OverviewResult,
  SourcesResult,
} from "../../observatory/domain/overview";
import type { SpecialtyResult } from "../../specialties/domain/api-contract";
import type { InverseResult } from "../../specialties/domain/inverse";
export type PanelReaders = {
  loadAtlas: (params?: SearchParams) => Promise<AtlasResult>;
  loadExplorer: (params: SearchParams) => Promise<ExplorerResult>;
  loadFormationSelection: (
    ids: string[],
  ) => Promise<{ id: string; result: DetailResult }[]>;
  loadOverview: (campaign?: string) => Promise<OverviewResult>;
  loadSources: () => Promise<SourcesResult>;
  loadSpecialties: (params: SearchParams) => Promise<SpecialtyResult>;
  loadInverseSpecialties: (params: SearchParams) => Promise<InverseResult>;
};
/** Same composition for native SSR and the publication-backed edge facade. */
export function createPanelLoader({
  loadAtlas,
  loadExplorer,
  loadFormationSelection,
  loadOverview,
  loadSources,
  loadSpecialties,
  loadInverseSpecialties,
}: PanelReaders) {
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
      apprentice: choice(
        apprentice.data,
        apprenticeId,
        params.q_apprenti ?? "",
      ),
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
  return async (panel: PanelId, search: string) => {
    const params = paramRecord(panelParams(panel, new URLSearchParams(search)));
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
  };
}
export type PanelPayload = Awaited<
  ReturnType<ReturnType<typeof createPanelLoader>>
>;
