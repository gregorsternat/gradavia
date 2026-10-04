import { csvCell } from "../../formations/domain/metrics";
import { atlasMetricKeys, type AtlasData } from "./api-contract";

export const datasetFormats = ["json", "csv", "metadata"] as const;
export type DatasetFormat = (typeof datasetFormats)[number];
export type DatasetQuery = {
  famille: "parcoursup" | "apprentissage" | "apb";
  campagne?: string;
  version?: string;
  format: DatasetFormat;
};
export function parseDatasetQuery(search: string): DatasetQuery | null {
  if (new TextEncoder().encode(search).length > 16_384) return null;
  const params = new URLSearchParams(search);
  const family = params.get("famille")?.trim() || "parcoursup";
  const campaign = params.get("campagne")?.trim();
  const version = params.get("version")?.trim().toLowerCase();
  const format = params.get("format")?.trim() || "json";
  if (
    !["parcoursup", "apprentissage", "apb"].includes(family) ||
    !datasetFormats.includes(format as DatasetFormat)
  )
    return null;
  if (campaign && !/^\d{4}$/.test(campaign)) return null;
  if (
    version &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      version,
    )
  )
    return null;
  return {
    famille: family as DatasetQuery["famille"],
    ...(campaign ? { campagne: campaign } : {}),
    ...(version ? { version } : {}),
    format: format as DatasetFormat,
  };
}
export function datasetPath(
  data: AtlasData,
  format: DatasetFormat = "json",
): string {
  const query = new URLSearchParams({
    famille: data.family,
    campagne: String(data.source.campaign),
    version: data.source.releaseId,
    format,
  });
  return `/api/v1/datasets?${query}`;
}
export function datasetMetadata(data: AtlasData) {
  return {
    schemaVersion: 1,
    source: data.source,
    family: data.family,
    records: data.items.length,
    definitions: data.definitions,
    coverage: data.coverage,
    notices: data.notices,
    sourceUrl: `https://data.enseignementsup-recherche.gouv.fr/explore/dataset/${encodeURIComponent(data.source.datasetId)}/`,
    snapshot: datasetPath(data),
    csv: datasetPath(data, "csv"),
    nullPolicy:
      "Null values have an explicit missing, suppressed or invalid state. Observed zero is retained. CSV contains a state column for every metric.",
    rowIdentity:
      "The release ID and source row number identify a record within one immutable snapshot; they do not establish continuity across releases or campaigns.",
  };
}
export function datasetCsv(data: AtlasData): string {
  const descriptions = [
    "id",
    "sourceFormationId",
    "establishmentId",
    "title",
    "establishment",
    "city",
    "department",
    "region",
    "type",
    "status",
    "selectivity",
    "latitude",
    "longitude",
  ] as const;
  const header = [
    "source_campaign",
    "source_dataset",
    "source_release",
    "source_license",
    ...descriptions,
    ...atlasMetricKeys.flatMap((key) => [key, `${key}_state`]),
  ];
  const lines = data.items.map((item) => [
    data.source.campaign,
    data.source.datasetId,
    data.source.releaseId,
    data.source.license,
    ...descriptions.map((key) => item[key]),
    ...atlasMetricKeys.flatMap((key) => [
      item.metrics[key],
      item.states[key] ?? "observed",
    ]),
  ]);
  return `\uFEFF${[header, ...lines].map((line) => line.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
