export type AtlasRef = {
  family: string;
  campaign: number;
  releaseId: string;
  datasetId: string;
};
export type Publication = {
  format: 1;
  atlases: AtlasRef[];
  pointers: { dataset: string; release: string | null }[];
};
export function selectAtlas(
  publication: Publication,
  params: URLSearchParams,
): AtlasRef | "invalid" | undefined {
  const family = params.get("famille")?.trim() || "parcoursup";
  const campaign = params.get("campagne")?.trim();
  const version = params.get("version")?.trim().toLowerCase();
  if (
    !["parcoursup", "apprentissage", "apb"].includes(family) ||
    (campaign && !/^\d{4}$/.test(campaign)) ||
    (version &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        version,
      ))
  )
    return "invalid";
  return publication.atlases
    .filter(
      (a) =>
        a.family === family &&
        (!campaign || a.campaign === Number(campaign)) &&
        (version
          ? a.releaseId === version
          : publication.pointers.some(
              (p) => p.dataset === a.datasetId && p.release === a.releaseId,
            )),
    )
    .sort(
      (a, b) =>
        b.campaign - a.campaign ||
        Number(a.datasetId === "fr-esr-parcoursup") -
          Number(b.datasetId === "fr-esr-parcoursup"),
    )[0];
}
export const atlasKey = (a: AtlasRef) => `${a.releaseId}-${a.campaign}`;
