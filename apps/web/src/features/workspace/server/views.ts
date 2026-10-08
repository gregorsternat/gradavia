import "server-only";
import { FormationExplorer } from "@/features/formations/ui/explorer";
import { AtlasExplorer } from "@/features/atlas/ui/explorer";
import { Overview } from "@/features/observatory/ui/overview";
import { Territories } from "@/features/observatory/ui/territories";
import { Sources } from "@/features/observatory/ui/sources";
import { DataAccess } from "@/features/atlas/ui/data-access";
import { SpecialtyExplorer } from "@/features/specialties/ui/explorer";
import { InverseSpecialties } from "@/features/specialties/ui/inverse";
import { ComparisonPageView } from "@/features/formations/ui/selection-pages";
import { FavoritesPageView } from "@/features/formations/ui/selection-pages";
import { BudgetCalculator } from "@/features/budget/ui/calculator";
import { AnalysisWorkbench } from "@/features/analysis/ui/workbench";
import { ModalityComparison } from "@/features/atlas/ui/modality-comparison";
import { Evolution } from "@/features/evolution/ui/evolution";
import { Quiz } from "@/features/discovery/ui/quiz";
export const serverViews = {
  FormationExplorer,
  AtlasExplorer,
  Overview,
  Territories,
  Sources,
  DataAccess,
  SpecialtyExplorer,
  InverseSpecialties,
  ComparisonPageView,
  FavoritesPageView,
  BudgetCalculator,
  AnalysisWorkbench,
  ModalityComparison,
  Evolution,
  Quiz,
};
