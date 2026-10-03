import type { Metadata } from "next";
import { loadExplorer } from "@/features/formations/server/load";
import { FormationExplorer } from "@/features/formations/ui/explorer";
import {
  explorerUrl,
  parseQuery,
  type SearchParams,
} from "@/features/formations/domain/explorer";

export const metadata: Metadata = {
  title: "Explorer les formations Parcoursup",
  description:
    "Recherchez les formations Parcoursup par campagne, territoire et type de formation, à partir des données publiques d’admission.",
};

export default async function FormationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = parseQuery(params);
  return (
    <FormationExplorer
      result={await loadExplorer(params)}
      retryUrl={explorerUrl(query, query.page)}
    />
  );
}
