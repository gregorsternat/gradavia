import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  FAVORITES_PAGE_SIZE,
  MAX_FAVORITES,
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
  const shared = params.partage === "1";
  const ids = parseSelectionIds(
    params.ids,
    shared ? MAX_FAVORITES : FAVORITES_PAGE_SIZE,
  );
  const page =
    typeof params.page === "string" && /^[1-9]\d{0,2}$/.test(params.page)
      ? Number(params.page)
      : 1;
  const results = [];
  // Shared lists resolve all bounded identities before an atomic local import.
  // Keep the existing four-request upstream concurrency across twelve-row batches.
  for (let offset = 0; offset < ids.length; offset += FAVORITES_PAGE_SIZE) {
    results.push(
      ...(await loadFormationSelection(
        ids.slice(offset, offset + FAVORITES_PAGE_SIZE),
      )),
    );
  }
  return (
    <FavoritesPageView
      results={results}
      shared={shared}
      ids={ids}
      page={page}
    />
  );
}
