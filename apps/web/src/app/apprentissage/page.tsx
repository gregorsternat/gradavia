import type { Metadata } from "next";
import { loadAtlas } from "@/features/atlas/server/load";
import { AtlasExplorer } from "@/features/atlas/ui/explorer";
import { parseExploration } from "@/features/atlas/domain/exploration";
import type { SearchParams } from "@/features/formations/domain/explorer";

export const metadata: Metadata = { title: "Explorer l’apprentissage" };
export default async function ApprenticeshipPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = { ...(await searchParams), famille: "apprentissage" };
  return (
    <AtlasExplorer
      result={await loadAtlas(params)}
      initialQuery={parseExploration(params)}
    />
  );
}
