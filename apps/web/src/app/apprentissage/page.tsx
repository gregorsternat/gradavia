import { pageMetadata } from "@/features/seo/domain/metadata";
import { loadAtlas } from "@/features/atlas/server/load";
import { AtlasExplorer } from "@/features/atlas/ui/explorer";
import { parseExploration } from "@/features/atlas/domain/exploration";
import type { SearchParams } from "@/features/formations/domain/explorer";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return pageMetadata("/apprentissage", await searchParams);
}
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
