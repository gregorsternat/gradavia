import {
  canonicalHref,
  panels,
  resolvePanel,
  spaces,
  type PanelId,
} from "../../workspace/domain/registry";

// Search aliases describe the tools; route ownership and destinations live in
// the workspace registry used by server rendering, tabs and metadata.
const commands: Partial<
  Record<PanelId, { label?: string; keywords: string[] }>
> = {
  formations: {
    label: "Rechercher des formations",
    keywords: ["parcoursup", "liste", "explorer"],
  },
  carte: {
    label: "Carte des formations",
    keywords: ["proximité", "ville", "rayon", "intérêts"],
  },
  apprentissage: {
    label: "Apprentissage",
    keywords: ["alternance", "contrat"],
  },
  specialites: {
    label: "Spécialités du bac",
    keywords: ["lycée", "doublette", "profil", "bac général"],
  },
  inverse: {
    label: "Spécialités : partir d’une formation",
    keywords: ["inverse"],
  },
  selection: {
    label: "Comparer ma sélection",
    keywords: ["comparaison", "sélection"],
  },
  modalites: {
    label: "Comparer les modalités",
    keywords: [
      "hors apprentissage",
      "apprentissage",
      "alternance",
      "Comparer hors apprentissage et apprentissage",
    ],
  },
  favoris: {
    label: "Mes favoris",
    keywords: [
      "listes",
      "préparation",
      "notes",
      "dossier",
      "enregistrées",
      "sauvegarder",
    ],
  },
  budget: {
    label: "Budget étudiant",
    keywords: ["coût", "logement", "scénarios"],
  },
  overview: { keywords: ["accueil", "statistiques"] },
  territoires: { keywords: ["région", "géographie", "villes"] },
  evolutions: {
    keywords: ["campagnes", "historique", "Comparer les campagnes"],
  },
  analyses: {
    keywords: ["graphiques", "distribution", "export", "statistiques"],
  },
  decouvrir: {
    keywords: [
      "découvrir",
      "données",
      "À vous d’estimer · découvrir les données",
    ],
  },
  sources: { keywords: ["indicateurs", "méthodologie"] },
  donnees: {
    keywords: [
      "données",
      "exports",
      "télécharger",
      "API publique et notebooks",
    ],
  },
  archives: { keywords: ["admission post-bac", "historique"] },
};
export const navigationGroups = spaces.map((space) => ({
  href: space.path,
  label: space.label,
  pages: (
    [
      ...space.panels,
      ...(space.path === "/formations" ? ["apprentissage" as const] : []),
    ] as PanelId[]
  ).map((id) => ({
    href: canonicalHref(panels[id].path),
    label: commands[id]?.label ?? panels[id].label,
    keywords: commands[id]?.keywords ?? [],
  })),
}));
export function navigationGroup(href: string, family?: string | null) {
  const url = new URL(href, "https://gradavia.invalid");
  if (family) url.searchParams.set("famille", family);
  if (
    url.pathname.startsWith("/atlas/") ||
    url.pathname.startsWith("/formations/")
  )
    return navigationGroups[0];
  const panel = resolvePanel(url.pathname, url.searchParams);
  return panel ? navigationGroups[panels[panel].space] : undefined;
}
