import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { parseIndicator } from "@/features/specialties/domain/explorer";
import { loadSpecialties } from "@/features/specialties/server/load";
import { SpecialtyExplorer } from "@/features/specialties/ui/explorer";

export const metadata: Metadata = {
  title: "Spécialités du bac",
  description:
    "Explorez les destinations Parcoursup des bacheliers généraux selon leur combinaison de spécialités, à partir des données publiques de 2025.",
};
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
