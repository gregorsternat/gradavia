export const navigationGroups = [
  {
    href: "/formations",
    label: "Formations",
    pages: [
      {
        href: "/formations",
        label: "Rechercher des formations",
        keywords: ["parcoursup", "liste", "explorer"],
      },
      {
        href: "/carte",
        label: "Carte des formations",
        keywords: ["proximité", "ville", "rayon"],
      },
      {
        href: "/apprentissage",
        label: "Apprentissage",
        keywords: ["alternance", "contrat"],
      },
    ],
  },
  {
    href: "/specialites",
    label: "Spécialités du bac",
    pages: [
      {
        href: "/specialites",
        label: "Spécialités du bac",
        keywords: ["lycée", "doublette", "profil"],
      },
      {
        href: "/specialites/inverse",
        label: "Spécialités : partir d’une formation",
        keywords: ["inverse"],
      },
    ],
  },
  {
    href: "/comparer",
    label: "Comparer",
    pages: [
      {
        href: "/comparer",
        label: "Comparer ma sélection",
        keywords: ["comparaison", "sélection"],
      },
      {
        href: "/modalites",
        label: "Comparer les modalités",
        keywords: [
          "hors apprentissage",
          "apprentissage",
          "alternance",
          "Comparer hors apprentissage et apprentissage",
        ],
      },
    ],
  },
  {
    href: "/favoris",
    label: "Mon projet",
    pages: [
      {
        href: "/favoris",
        label: "Mes favoris",
        keywords: ["listes", "préparation", "notes", "dossier", "enregistrées"],
      },
      {
        href: "/budget",
        label: "Budget étudiant",
        keywords: ["coût", "logement", "scénarios"],
      },
    ],
  },
  {
    href: "/observatoire",
    label: "Observatoire",
    pages: [
      {
        href: "/observatoire",
        label: "Vue d’ensemble",
        keywords: ["accueil", "statistiques"],
      },
      {
        href: "/territoires",
        label: "Territoires",
        keywords: ["région", "géographie"],
      },
      {
        href: "/evolutions",
        label: "Évolutions",
        keywords: ["campagnes", "historique", "Comparer les campagnes"],
      },
      {
        href: "/analyses",
        label: "Atelier d’analyse",
        keywords: ["graphiques", "distribution", "export"],
      },
      {
        href: "/decouvrir",
        label: "À vous d’estimer",
        keywords: [
          "découvrir",
          "données",
          "À vous d’estimer · découvrir les données",
        ],
      },
    ],
  },
  {
    href: "/sources",
    label: "Données & méthode",
    pages: [
      {
        href: "/sources",
        label: "Sources et définitions",
        keywords: ["indicateurs", "méthodologie"],
      },
      {
        href: "/donnees",
        label: "API et notebooks",
        keywords: [
          "données",
          "exports",
          "télécharger",
          "API publique et notebooks",
        ],
      },
      {
        href: "/archives",
        label: "Archives APB",
        keywords: ["admission post-bac", "historique"],
      },
    ],
  },
];

export function navigationGroup(pathname: string, family?: string | null) {
  if (pathname === "/carte" && family === "apb") return navigationGroups[5];
  if (pathname.startsWith("/atlas/")) return navigationGroups[0];
  return navigationGroups.find((group) =>
    group.pages.some(
      (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
    ),
  );
}

const sharedFilters = ["campagne", "q", "type", "region", "statut"];
const mapSort: Record<string, string> = {
  nom: "name",
  capacite: "capacity",
  candidatures: "applications",
};
const listSort: Record<string, string> = {
  name: "nom",
  capacity: "capacite",
  applications: "candidatures",
};

/** Different readers support different filters; never silently copy an unsupported constraint. */
export function representationUrl(
  pathname: string,
  params: URLSearchParams,
  view: "liste" | "carte",
) {
  const apprenticeship =
    pathname === "/apprentissage" ||
    (pathname === "/carte" && params.get("famille") === "apprentissage");
  if (apprenticeship) {
    const next = new URLSearchParams(params);
    next.set("famille", "apprentissage");
    next.set("vue", view);
    return `/apprentissage?${next}`;
  }
  if ((pathname === "/formations") === (view === "liste"))
    return `${pathname}${params.size ? `?${params}` : ""}`;
  const next = new URLSearchParams();
  for (const key of sharedFilters) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  const sorts = view === "carte" ? mapSort : listSort;
  const requestedSort = params.get("tri") ?? "";
  const sort = Object.hasOwn(sorts, requestedSort)
    ? sorts[requestedSort]
    : undefined;
  if (sort) next.set("tri", sort);
  return `${view === "carte" ? "/carte" : "/formations"}${next.size ? `?${next}` : ""}`;
}

export function scopeUrl(
  params: URLSearchParams,
  family: string,
  view: "liste" | "carte",
) {
  // A different source family has its own campaigns, taxonomy and release IDs.
  const next = new URLSearchParams();
  const q = params.get("q");
  if (q) next.set("q", q);
  if (family === "apprentissage") next.set("vue", view);
  const path =
    family === "apprentissage"
      ? "/apprentissage"
      : view === "liste"
        ? "/formations"
        : "/carte";
  return `${path}${next.size ? `?${next}` : ""}`;
}
