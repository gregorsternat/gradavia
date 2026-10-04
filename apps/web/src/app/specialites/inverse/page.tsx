import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { loadInverseSpecialties } from "@/features/specialties/server/inverse";
import { InverseSpecialties } from "@/features/specialties/ui/inverse";
import { parseIndicator } from "@/features/specialties/domain/explorer";
export const metadata: Metadata = { title: "Spécialités par formation" };
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
