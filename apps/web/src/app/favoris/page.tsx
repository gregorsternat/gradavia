import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  FAVORITES_PAGE_SIZE,
  parseSelectionIds,
} from "@/features/formations/domain/selection";
import { loadFormationSelection } from "@/features/formations/server/load";
import { FavoritesPageView } from "@/features/formations/ui/selection-pages";

export const metadata: Metadata = { title: "Mes favoris" };
export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const ids = parseSelectionIds(params.ids, FAVORITES_PAGE_SIZE);
  const page =
    typeof params.page === "string" && /^[1-9]\d{0,2}$/.test(params.page)
      ? Number(params.page)
      : 1;
  return (
    <FavoritesPageView
      results={await loadFormationSelection(ids)}
      ids={ids}
      page={page}
    />
  );
}
