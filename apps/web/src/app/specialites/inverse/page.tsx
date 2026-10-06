import { pageMetadata } from "@/features/seo/domain/metadata";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { loadInverseSpecialties } from "@/features/specialties/server/inverse";
import { InverseSpecialties } from "@/features/specialties/ui/inverse";
import { parseIndicator } from "@/features/specialties/domain/explorer";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return pageMetadata("/specialites/inverse", await searchParams);
}
export default async function InversePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <InverseSpecialties
      result={await loadInverseSpecialties(params)}
      indicator={params.tri ? parseIndicator(params.tri) : "accepted"}
    />
  );
}
