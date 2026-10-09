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
  BudgetCalculator: () =>
    import("@/features/budget/ui/calculator").then((m) => m.BudgetCalculator),
  AnalysisWorkbench: () =>
    import("@/features/analysis/ui/workbench").then((m) => m.AnalysisWorkbench),
  ModalityComparison: () =>
    import("@/features/atlas/ui/modality-comparison").then(
      (m) => m.ModalityComparison,
    ),
  Evolution: () =>
    import("@/features/evolution/ui/evolution").then((m) => m.Evolution),
  Quiz: () => import("@/features/discovery/ui/quiz").then((m) => m.Quiz),
};
export type ViewId = keyof typeof viewLoaders;
