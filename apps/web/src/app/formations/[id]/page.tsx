import { createMetadata } from "@/features/seo/domain/metadata";
import {
  detailMetadata,
  detailStructuredData,
} from "@/features/seo/domain/structured-data";
import { StructuredData } from "@/features/seo/ui/structured-data";
import { notFound } from "next/navigation";
import { loadFormation } from "@/features/formations/server/load";
import { FormationDetailView } from "@/features/formations/ui/detail";
import { ButtonLink } from "@/components/motion/button/base";
import { decodeFormationRouteId } from "@/features/formations/domain/api-contract";
import { formationUrl } from "@/features/formations/domain/metrics";
import { loadAtlas, loadAtlasDetail } from "@/features/atlas/server/load";
import { peerSummary } from "@/features/atlas/domain/exploration";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = decodeFormationRouteId((await params).id);
  if (!id) notFound();
  const result = await loadFormation(id);
  if (result.status === "not-found") notFound();
  if (result.status !== "ready")
    return createMetadata({
      title: "Formation temporairement indisponible",
      description: "Les données de cette formation n’ont pas pu être chargées.",
      path: formationUrl(id),
      noIndex: true,
    });
  return detailMetadata(
    result.data.formation,
    result.data.source,
    "parcoursup",
  );
}
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
  const [enriched, atlas] = await Promise.all([
    loadAtlasDetail(id),
    loadAtlas({
      campagne: String(result.data.source.campaign),
      version: result.data.source.releaseId,
    }),
  ]);
  return (
    <>
      <StructuredData
        data={detailStructuredData(
          result.data.formation,
          result.data.source,
          "parcoursup",
        )}
      />
      <FormationDetailView
        detail={result.data}
        enriched={enriched.status === "ready" ? enriched.data : undefined}
        peers={
          enriched.status === "ready" && atlas.status === "ready"
            ? peerSummary(atlas.data.items, enriched.data.item)
            : undefined
        }
      />
    </>
  );
}
