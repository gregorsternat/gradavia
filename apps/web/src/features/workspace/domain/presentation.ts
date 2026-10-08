import type { ComponentProps } from "react";
import { parseQuery, explorerUrl } from "../../formations/domain/explorer";
import {
  parseSelectionIds,
  MAX_FAVORITES,
  FAVORITES_PAGE_SIZE,
} from "../../formations/domain/selection";
import { parseIndicator } from "../../specialties/domain/explorer";
import { parseExploration } from "../../atlas/domain/exploration";
import type { PanelPayload } from "../server/load";
import { paramRecord, type PanelId } from "./registry";
import type { ViewId, viewLoaders } from "../ui/views";
export type Presentation =
  | {
      [K in ViewId]: {
        view: K;
        props: ComponentProps<Awaited<ReturnType<(typeof viewLoaders)[K]>>> &
          object;
        key?: string;
      };
    }[ViewId]
  | { view: "message"; message: string };
export function presentation(
  panel: PanelId,
  payload: PanelPayload,
  params: URLSearchParams,
): Presentation {
  const query = paramRecord(params);
  switch (payload.kind) {
    case "formations":
      return {
        view: "FormationExplorer",
        props: {
          result: payload.result,
          retryUrl: explorerUrl(parseQuery(query), parseQuery(query).page),
          initialView:
            query.vue === "cartes"
              ? "cartes"
              : query.vue === "liste"
                ? "liste"
                : undefined,
        },
      };
    case "atlas":
      return panel === "analyses"
        ? { view: "AnalysisWorkbench", props: { result: payload.result } }
        : {
            view: "AtlasExplorer",
            props: {
              result: payload.result,
              initialQuery: parseExploration(query),
            },
          };
    case "overview":
      return {
        view: panel === "territoires" ? "Territories" : "Overview",
        props: { result: payload.result },
      };
    case "sources":
      return {
        view: panel === "donnees" ? "DataAccess" : "Sources",
        props: { result: payload.result },
      };
    case "specialites":
      return {
        view: "SpecialtyExplorer",
        props: { result: payload.result, indicator: parseIndicator(query.tri) },
      };
    case "inverse":
      return {
        view: "InverseSpecialties",
        props: {
          result: payload.result,
          indicator: query.tri ? parseIndicator(query.tri) : "accepted",
        },
      };
    case "selection":
      return {
        view: "ComparisonPageView",
        props: {
          results: payload.results,
          ids: parseSelectionIds(query.ids),
          explicit: params.has("ids"),
        },
      };
    case "favoris":
      return {
        view: "FavoritesPageView",
        props: {
          results: payload.results,
          shared: query.partage === "1",
          ids: parseSelectionIds(
            query.ids,
            query.partage === "1" ? MAX_FAVORITES : FAVORITES_PAGE_SIZE,
          ),
          page: /^[1-9]\d{0,2}$/.test(query.page ?? "")
            ? Number(query.page)
            : 1,
        },
      };
    case "budget":
      return { view: "BudgetCalculator", props: {} };
    case "modalites":
      return payload.result.status === "ready"
        ? {
            view: "ModalityComparison",
            props: {
              ...payload.result,
              params: { campagne: payload.result.params.campagne, ...query },
            },
          }
        : {
            view: "message",
            message:
              payload.result.status === "unavailable"
                ? "La comparaison est temporairement indisponible."
                : "Aucune campagne commune publiée pour ces deux modalités.",
          };
    case "evolutions":
      return payload.result.status === "ready"
        ? {
            view: "Evolution",
            key: `${payload.result.data.before.source.releaseId}:${payload.result.data.after.source.releaseId}`,
            props: { data: payload.result.data },
          }
        : {
            view: "message",
            message:
              (payload.result.status === "unavailable"
                ? "Les données sont temporairement indisponibles"
                : "Deux campagnes distinctes sont nécessaires") +
              ". Une version demandée indisponible n’est jamais remplacée automatiquement.",
          };
    case "decouvrir":
      return payload.result.status === "ready"
        ? {
            view: "Quiz",
            key: payload.result.source.releaseId,
            props: {
              questions: payload.result.questions,
              source: payload.result.source,
            },
          }
        : {
            view: "message",
            message:
              payload.result.status === "empty"
                ? "Aucune campagne disponible."
                : "Les données sont temporairement indisponibles.",
          };
  }
}
