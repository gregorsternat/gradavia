import { redirect } from "next/navigation";
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
  return pageMetadata("/carte", await searchParams);
}
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  if (params.famille === "apb") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : [])
        query.append(key, item);
    }
    redirect(`/archives?${query}`);
  }
  return (
    <AtlasExplorer
      result={await loadAtlas(params)}
      initialQuery={parseExploration(params)}
    />
  );
}
