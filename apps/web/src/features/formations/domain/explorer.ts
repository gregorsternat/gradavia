import type { ExplorerQuery } from "./api-contract";
export { PAGE_SIZE } from "./api-contract";
export type {
  ExplorerQuery,
  CampaignSource,
  Formation,
  Facets,
  ExplorerData,
  ExplorerResult,
} from "./api-contract";

export const FILTER_KEYS = [
  "type",
  "region",
  "departement",
  "statut",
  "selectivite",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type SearchParams = Record<string, string | string[] | undefined>;
export type Filters = Record<FilterKey, string>;

export function parseQuery(params: SearchParams): ExplorerQuery {
  const value = (key: string, limit = 160) => {
    const raw = params[key];
    return Array.from(
      (Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "")).trim(),
    )
      .slice(0, limit)
      .join("");
  };
  const campaign = value("campagne");
  const page = value("page");
  return {
    campagne: /^\d{4}$/.test(campaign) ? Number(campaign) : null,
    q: value("q", 120).replace(/\s+/g, " "),
    page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
    type: value("type"),
    region: value("region"),
    departement: value("departement"),
    statut: value("statut"),
    selectivite: value("selectivite"),
  };
}

export function explorerUrl(query: ExplorerQuery, page = 1): string {
  const params = new URLSearchParams();
  if (query.campagne) params.set("campagne", String(query.campagne));
  if (query.q) params.set("q", query.q);
  for (const key of FILTER_KEYS) if (query[key]) params.set(key, query[key]);
  if (page > 1) params.set("page", String(page));
  return `/formations${params.size ? `?${params}` : ""}`;
}

export function datasetUrl(id: string): string {
  return `https://data.enseignementsup-recherche.gouv.fr/explore/dataset/${encodeURIComponent(id)}/`;
}
