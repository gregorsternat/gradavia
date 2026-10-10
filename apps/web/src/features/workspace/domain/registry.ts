import type { SearchParams } from "@/features/formations/domain/explorer";

export const spaces = [
  { path: "/formations", label: "Formations", panels: ["formations", "carte"] },
  {
    path: "/specialites",
    label: "Spécialités du bac",
    panels: ["specialites", "inverse"],
  },
  { path: "/comparer", label: "Comparer", panels: ["selection", "modalites"] },
  { path: "/favoris", label: "Mon projet", panels: ["favoris", "budget"] },
  {
    path: "/observatoire",
    label: "Observatoire",
    panels: ["overview", "territoires", "evolutions", "analyses", "decouvrir"],
  },
  {
    path: "/sources",
    label: "Données & méthode",
    panels: ["sources", "donnees", "archives"],
  },
] as const;
export const panels = {
  formations: { path: "/formations", tab: "liste", label: "Liste", space: 0 },
  carte: { path: "/carte", tab: "carte", label: "Carte", space: 0 },
  apprentissage: {
    path: "/apprentissage",
    tab: "liste",
    label: "Liste",
    space: 0,
  },
  "apprentissage-carte": {
    path: "/apprentissage",
    tab: "carte",
    label: "Carte",
    space: 0,
  },
  specialites: {
    path: "/specialites",
    tab: "specialites",
    label: "Depuis mes spécialités",
    space: 1,
  },
  inverse: {
    path: "/specialites/inverse",
    tab: "formation",
    label: "Depuis une formation",
    space: 1,
  },
  selection: {
    path: "/comparer",
    tab: "selection",
    label: "Ma sélection",
    space: 2,
  },
  modalites: {
    path: "/modalites",
    tab: "modalites",
    label: "Modalités",
    space: 2,
  },
  favoris: { path: "/favoris", tab: "favoris", label: "Favoris", space: 3 },
  budget: { path: "/budget", tab: "budget", label: "Budget", space: 3 },
  overview: {
    path: "/observatoire",
    tab: "ensemble",
    label: "Vue d’ensemble",
    space: 4,
  },
  territoires: {
    path: "/territoires",
    tab: "territoires",
    label: "Territoires",
    space: 4,
  },
  evolutions: {
    path: "/evolutions",
    tab: "evolutions",
    label: "Évolutions",
    space: 4,
  },
  analyses: {
    path: "/analyses",
    tab: "analyses",
    label: "Atelier d’analyse",
    space: 4,
  },
  decouvrir: {
    path: "/decouvrir",
    tab: "decouvrir",
    label: "À vous d’estimer",
    space: 4,
  },
  sources: {
    path: "/sources",
    tab: "sources",
    label: "Sources et définitions",
    space: 5,
  },
  donnees: {
    path: "/donnees",
    tab: "donnees",
    label: "API et notebooks",
    space: 5,
  },
  archives: {
    path: "/archives",
    tab: "archives",
    label: "Archives APB",
    space: 5,
  },
} as const;
export type PanelId = keyof typeof panels;
export function isPanel(value: string): value is PanelId {
  return Object.hasOwn(panels, value);
}
export function searchString(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      query.append(key, item);
  return query.toString();
}
/** Match feature loaders' first-value semantics for repeated query keys. */
export function paramRecord(query: URLSearchParams): Record<string, string> {
  return Object.fromEntries(
    [...new Set(query.keys())].map((key) => [key, query.get(key)!]),
  );
}
export function resolvePanel(
  path: string,
  query: URLSearchParams,
): PanelId | null {
  if (path === "/carte")
    return query.get("famille") === "apb"
      ? "archives"
      : query.get("famille") === "apprentissage"
        ? query.get("vue") === "liste"
          ? "apprentissage"
          : "apprentissage-carte"
        : "carte";
  if (path === "/apprentissage")
    return query.get("vue") === "liste"
      ? "apprentissage"
      : "apprentissage-carte";
  const space = spaces.find((space) => space.path === path);
  if (space) {
    const panel =
      space.panels.find((id) => panels[id].tab === query.get("onglet")) ??
      space.panels[0];
    if (
      space.path === "/formations" &&
      query.get("famille") === "apprentissage"
    )
      return panel === "carte" ? "apprentissage-carte" : "apprentissage";
    return panel;
  }
  return (
    (Object.keys(panels) as PanelId[]).find((id) => panels[id].path === path) ??
    null
  );
}
export function panelParams(
  panel: PanelId,
  input: URLSearchParams,
): URLSearchParams {
  const query = new URLSearchParams(input);
  query.delete("onglet");
  if (panel.startsWith("apprentissage")) {
    query.set("famille", "apprentissage");
    query.set("vue", panel === "apprentissage" ? "liste" : "carte");
  } else if (panel === "archives") query.set("famille", "apb");
  else if (panel === "carte") query.set("famille", "parcoursup");
  return query;
}
export function panelHref(
  panel: PanelId,
  input = new URLSearchParams(),
  hash = "",
): string {
  const info = panels[panel];
  const space = spaces[info.space];
  const query = new URLSearchParams(input);
  query.delete("onglet");
  if (info.tab !== panels[space.panels[0]].tab) query.set("onglet", info.tab);
  if (panel.startsWith("apprentissage")) {
    query.set("famille", "apprentissage");
    query.delete("vue");
  }
  if (panel === "archives" || panel === "carte" || panel === "formations")
    query.delete("famille");
  return `${space.path}${query.size ? `?${query}` : ""}${hash}`;
}
/** Leave external URLs, detail pages, downloads and fragment-only links alone. */
export function canonicalHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://gradavia.invalid");
  const panel = resolvePanel(url.pathname, url.searchParams);
  return panel ? panelHref(panel, url.searchParams, url.hash) : href;
}
export function resourceKey(panel: PanelId, query: URLSearchParams): string {
  let reader: string = panel;
  let keys: string[];
  switch (panel) {
    case "overview":
    case "territoires":
      reader = "overview";
      keys = ["campagne"];
      break;
    case "sources":
    case "donnees":
      reader = "sources";
      keys = [];
      break;
    case "carte":
    case "apprentissage":
    case "apprentissage-carte":
    case "archives":
    case "analyses":
      reader = "atlas";
      keys = ["famille", "campagne", "version"];
      break;
    case "formations":
      keys = [
        "campagne",
        "q",
        "type",
        "region",
        "departement",
        "statut",
        "selectivite",
        "tri",
        "page",
      ];
      break;
    case "specialites":
      keys = ["paire", "groupe"];
      break;
    case "inverse":
      keys = ["formation"];
      break;
    case "selection":
      keys = ["ids"];
      break;
    case "favoris":
      keys = ["ids", "partage"];
      break;
    case "budget":
      keys = [];
      break;
    case "modalites":
      keys = ["classique", "apprenti", "q_classique", "q_apprenti", "campagne"];
      break;
    case "evolutions":
      keys = ["famille", "debut", "fin", "version_debut", "version_fin"];
      break;
    case "decouvrir":
      keys = ["campagne", "version"];
      break;
  }
  const normalized = panelParams(panel, query);
  if (panel === "formations") {
    if (normalized.get("tri") === "nom") normalized.delete("tri");
    if (normalized.get("page") === "1") normalized.delete("page");
  }
  if (reader === "atlas" && !normalized.has("famille"))
    normalized.set("famille", "parcoursup");
  const params = new URLSearchParams();
  for (const key of keys)
    if (normalized.has(key)) params.set(key, normalized.get(key)!);
  return `${reader}?${params}`;
}

const common = ["campagne", "q", "type", "region", "statut"];
const mapSort: Record<string, string> = {
  nom: "name",
  capacite: "capacity",
  candidatures: "applications",
};
/** Preserve destination-only criteria, but reset pagination when shared criteria change. */
export function representationParams(
  from: PanelId,
  to: PanelId,
  current: URLSearchParams,
  remembered?: URLSearchParams,
) {
  if (from.startsWith("apprentissage") && to.startsWith("apprentissage"))
    return panelParams(to, current);
  const next = new URLSearchParams(remembered);
  let changed = false;
  for (const key of common) {
    const value = current.get(key);
    if (value !== next.get(key)) changed = true;
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const sort = current.get("tri") ?? (from === "formations" ? "nom" : "name");
  const translated =
    from === "formations"
      ? Object.hasOwn(mapSort, sort)
        ? mapSort[sort]
        : undefined
      : Object.entries(mapSort).find(([, v]) => v === sort)?.[0];
  if (translated && translated !== next.get("tri")) {
    const defaultSort = to === "formations" ? "nom" : "name";
    changed ||= translated !== (next.get("tri") ?? defaultSort);
    next.set("tri", translated);
  }
  if (changed) next.delete("page");
  return next;
}
