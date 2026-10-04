import { notFound } from "next/navigation";
import { decodeFormationRouteId } from "@/features/formations/domain/api-contract";
import { loadAtlas, loadAtlasDetail } from "@/features/atlas/server/load";
import { peerSummary } from "@/features/atlas/domain/exploration";
import { AtlasDetailView } from "@/features/atlas/ui/detail-insights";

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
    <AtlasDetailView
      detail={detail}
      peers={
        atlas.status === "ready"
          ? peerSummary(atlas.data.items, detail.item)
          : undefined
      }
    />
  );
}
