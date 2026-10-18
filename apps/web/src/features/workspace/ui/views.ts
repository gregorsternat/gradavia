import type { PanelId } from "../domain/registry";

// Literal imports keep each tool independently loadable. The server resolves
// only the requested view; the browser imports another view on first activation.
export const viewLoaders = {
  FormationExplorer: () =>
    import("@/features/formations/ui/explorer").then(
      (m) => m.FormationExplorer,
    ),
  AtlasExplorer: () =>
    import("@/features/atlas/ui/explorer").then((m) => m.AtlasExplorer),
  Overview: () =>
    import("@/features/observatory/ui/overview").then((m) => m.Overview),
  Territories: () =>
    import("@/features/observatory/ui/territories").then((m) => m.Territories),
  Sources: () =>
    import("@/features/observatory/ui/sources").then((m) => m.Sources),
  DataAccess: () =>
    import("@/features/atlas/ui/data-access").then((m) => m.DataAccess),
  SpecialtyExplorer: () =>
    import("@/features/specialties/ui/explorer").then(
      (m) => m.SpecialtyExplorer,
    ),
  InverseSpecialties: () =>
    import("@/features/specialties/ui/inverse").then(
      (m) => m.InverseSpecialties,
    ),
  ComparisonPageView: () =>
    import("@/features/formations/ui/selection-pages").then(
      (m) => m.ComparisonPageView,
    ),
  FavoritesPageView: () =>
    import("@/features/formations/ui/selection-pages").then(
      (m) => m.FavoritesPageView,
    ),
  AnalysisWorkbench: () =>
    import("@/features/analysis/ui/workbench").then((m) => m.AnalysisWorkbench),
  ModalityComparison: () =>
    import("@/features/atlas/ui/modality-comparison").then(
      (m) => m.ModalityComparison,
    ),
  Evolution: () =>
    import("@/features/evolution/ui/evolution").then((m) => m.Evolution),
};
export type ViewId = keyof typeof viewLoaders;

const panelViews = {
  formations: "FormationExplorer",
  carte: "AtlasExplorer",
  apprentissage: "AtlasExplorer",
  "apprentissage-carte": "AtlasExplorer",
  specialites: "SpecialtyExplorer",
  inverse: "InverseSpecialties",
  selection: "ComparisonPageView",
  modalites: "ModalityComparison",
  favoris: "FavoritesPageView",
  overview: "Overview",
  territoires: "Territories",
  evolutions: "Evolution",
  analyses: "AnalysisWorkbench",
  sources: "Sources",
  donnees: "DataAccess",
  archives: "AtlasExplorer",
} satisfies Record<PanelId, ViewId>;

/** Activation, including history, starts code before the data response arrives. */
export function preloadPanel(panel: PanelId, params: URLSearchParams) {
  void viewLoaders[panelViews[panel]]().catch(() => {});
  if (
    panel === "carte" ||
    panel === "apprentissage-carte" ||
    (panel === "archives" && params.get("vue") !== "liste")
  ) {
    // This function only runs in the browser; Leaflet requires window at import.
    void import("@/features/atlas/ui/leaflet-map").catch(() => {});
  }
}
