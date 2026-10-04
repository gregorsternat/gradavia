import type { Metadata } from "next";
import { loadAtlas } from "@/features/atlas/server/load";
import { AtlasExplorer } from "@/features/atlas/ui/explorer";
import { parseExploration } from "@/features/atlas/domain/exploration";
import type { SearchParams } from "@/features/formations/domain/explorer";

export const metadata: Metadata = { title: "Archives Admission Post-Bac" };
export default async function ArchivesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = { ...(await searchParams), famille: "apb" };
  return (
    <AtlasExplorer
      result={await loadAtlas(params)}
      initialQuery={parseExploration(params)}
    />
  );
}
