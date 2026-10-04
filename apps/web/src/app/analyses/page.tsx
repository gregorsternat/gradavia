import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { loadAtlas } from "@/features/atlas/server/load";
import { AnalysisWorkbench } from "@/features/analysis/ui/workbench";

export const metadata: Metadata = { title: "Atelier d’analyse" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <AnalysisWorkbench result={await loadAtlas(params)} />;
}
