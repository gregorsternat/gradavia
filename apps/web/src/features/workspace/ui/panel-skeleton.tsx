import { SkeletonPage } from "@/components/skeleton";
import LoadingFormations, {
  ComparisonSkeleton,
  FavoritesSkeleton,
} from "@/features/formations/ui/loading";
import {
  AtlasSkeleton,
  DataAccessSkeleton,
  ModalitySkeleton,
} from "@/features/atlas/ui/loading";
import ObservatoryLoading, {
  SourcesSkeleton,
  TerritoriesSkeleton,
} from "@/features/observatory/ui/loading";
import { SpecialtiesSkeleton } from "@/features/specialties/ui/loading";
import { BudgetSkeleton } from "@/features/budget/ui/loading";
import { AnalysisSkeleton } from "@/features/analysis/ui/loading";
import { EvolutionSkeleton } from "@/features/evolution/ui/loading";
import { QuizSkeleton } from "@/features/discovery/ui/loading";
import type { PanelId } from "../domain/registry";

const titles = {
  formations: "Explorer les formations",
  carte: "Carte des formations",
  apprentissage: "Formations en apprentissage",
  "apprentissage-carte": "Carte des formations en apprentissage",
  archives: "Archives APB",
  specialites: "Depuis mes spécialités",
  inverse: "Depuis une formation",
  selection: "Comparer les formations",
  modalites: "Comparer les modalités",
  favoris: "Mes favoris",
  budget: "Mon budget étudiant",
  overview: "Vue d’ensemble",
  territoires: "Territoires",
  evolutions: "Évolutions",
  analyses: "Atelier d’analyse",
  decouvrir: "À votre avis ?",
  sources: "Données & méthode",
  donnees: "Réutiliser les données",
} satisfies Record<PanelId, string>;

export function PanelSkeleton({
  panel,
  params,
}: {
  panel: PanelId;
  params: URLSearchParams;
}) {
  let content;
  switch (panel) {
    case "formations":
      content = <LoadingFormations view={params.get("vue") ?? undefined} />;
      break;
    case "carte":
    case "apprentissage-carte":
      content = <AtlasSkeleton map />;
      break;
    case "apprentissage":
      content = <AtlasSkeleton map={false} />;
      break;
    case "archives":
      content = <AtlasSkeleton map={params.get("vue") !== "liste"} />;
      break;
    case "specialites":
      content = <SpecialtiesSkeleton />;
      break;
    case "inverse":
      content = <SpecialtiesSkeleton inverse />;
      break;
    case "selection":
      content = <ComparisonSkeleton />;
      break;
    case "modalites":
      content = <ModalitySkeleton />;
      break;
    case "favoris":
      content = <FavoritesSkeleton />;
      break;
    case "budget":
      content = <BudgetSkeleton />;
      break;
    case "overview":
      content = <ObservatoryLoading />;
      break;
    case "territoires":
      content = <TerritoriesSkeleton />;
      break;
    case "evolutions":
      content = <EvolutionSkeleton />;
      break;
    case "analyses":
      content = <AnalysisSkeleton />;
      break;
    case "decouvrir":
      content = <QuizSkeleton />;
      break;
    case "sources":
      content = <SourcesSkeleton />;
      break;
    case "donnees":
      content = <DataAccessSkeleton />;
      break;
  }
  return (
    <SkeletonPage title={titles[panel]} name={panel}>
      {content}
    </SkeletonPage>
  );
}
