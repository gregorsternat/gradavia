import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { parseSelectionIds } from "@/features/formations/domain/selection";
import { loadFormationSelection } from "@/features/formations/server/load";
import { ComparisonPageView } from "@/features/formations/ui/selection-pages";

export const metadata: Metadata = { title: "Comparer les formations" };
export default async function ComparisonPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const ids = parseSelectionIds(params.ids);
  return (
    <ComparisonPageView
      results={await loadFormationSelection(ids)}
      ids={ids}
      explicit={params.ids !== undefined}
    />
  );
}
