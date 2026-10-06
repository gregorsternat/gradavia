import { pageMetadata } from "@/features/seo/domain/metadata";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { parseIndicator } from "@/features/specialties/domain/explorer";
import { loadSpecialties } from "@/features/specialties/server/load";
import { SpecialtyExplorer } from "@/features/specialties/ui/explorer";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return pageMetadata("/specialites", await searchParams);
}
export default async function SpecialtiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <SpecialtyExplorer
      result={await loadSpecialties(params)}
      indicator={parseIndicator(params.tri)}
    />
  );
}
