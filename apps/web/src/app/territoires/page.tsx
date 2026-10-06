import type { SearchParams } from "@/features/formations/domain/explorer";
import { pageMetadata } from "@/features/seo/domain/metadata";
import { loadOverview } from "@/features/observatory/server/load";
import { Territories } from "@/features/observatory/ui/territories";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return pageMetadata("/territoires", await searchParams);
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ campagne?: string }>;
}) {
  const { campagne } = await searchParams;
  return <Territories result={await loadOverview(campagne)} />;
}
