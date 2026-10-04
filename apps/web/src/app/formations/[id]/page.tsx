import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFormation } from "@/features/formations/server/load";
import { FormationDetailView } from "@/features/formations/ui/detail";
import { ButtonLink } from "@/components/motion/button/base";
import { decodeFormationRouteId } from "@/features/formations/domain/api-contract";
import { formationUrl } from "@/features/formations/domain/metrics";

export const metadata: Metadata = { title: "Formation · Parcoursup" };
export default async function FormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: segment } = await params;
  const id = decodeFormationRouteId(segment);
  if (id === null) notFound();
  const result = await loadFormation(id);
  if (result.status === "not-found") notFound();
  if (result.status === "unavailable")
    return (
      <main id="contenu" className="py-14">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cette formation est temporairement indisponible.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Les données n’ont pas pu être chargées.
        </p>
        <ButtonLink
          href={formationUrl(id)}
          variant="secondary"
          className="mt-6 rounded-lg"
        >
          Réessayer
        </ButtonLink>
      </main>
    );
  return <FormationDetailView detail={result.data} />;
}
