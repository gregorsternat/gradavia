import { notFound } from "next/navigation";
import { decodeFormationRouteId } from "@/features/formations/domain/api-contract";
import { loadAtlas, loadAtlasDetail } from "@/features/atlas/server/load";
import { peerSummary } from "@/features/atlas/domain/exploration";
import { AtlasDetailView } from "@/features/atlas/ui/detail-insights";
import { createMetadata } from "@/features/seo/domain/metadata";
import {
  detailMetadata,
  detailStructuredData,
} from "@/features/seo/domain/structured-data";
import { StructuredData } from "@/features/seo/ui/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = decodeFormationRouteId((await params).id);
  if (!id) notFound();
  const result = await loadAtlasDetail(id);
  if (result.status === "not-found") notFound();
  if (result.status !== "ready")
    return createMetadata({
      title: "Formation temporairement indisponible",
      description: "Les données de cette formation n’ont pas pu être chargées.",
      path: `/atlas/${encodeURIComponent(id)}`,
      noIndex: true,
    });
  return detailMetadata(
    result.data.item,
    result.data.source,
    result.data.family,
  );
}

export default async function AtlasDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = decodeFormationRouteId((await params).id);
  if (!id) notFound();
  const result = await loadAtlasDetail(id);
  if (result.status === "not-found") notFound();
  if (result.status !== "ready")
    return (
      <main id="contenu" className="py-12">
        <h1 className="text-2xl font-semibold">
          Cette formation est temporairement indisponible.
        </h1>
      </main>
    );
  const detail = result.data;
  const atlas = await loadAtlas({
    famille: detail.family,
    campagne: String(detail.source.campaign),
    version: detail.source.releaseId,
  });
  return (
    <>
      <StructuredData
        data={detailStructuredData(detail.item, detail.source, detail.family)}
      />
      <AtlasDetailView
        detail={detail}
        peers={
          atlas.status === "ready"
            ? peerSummary(atlas.data.items, detail.item)
            : undefined
        }
      />
    </>
  );
}
