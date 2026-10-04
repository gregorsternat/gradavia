import {
  atlasMetricKeys,
  type AtlasData,
  type AtlasItem,
} from "../../atlas/domain/api-contract";
import {
  analysisHref,
  dimensionLabels,
  distribution,
  formatBoundary,
  formatMeasure,
  grouped,
  matrix,
  measureLabels,
  measureValue,
  quality,
  type AnalysisConfig,
} from "./analysis";

export const analysisMethodology =
  "One immutable source release and campaign. Source rows retain duplicates. Candidature sums are not unique people. Sums use observed values only. Rate summaries are unweighted medians of source records, not population rates. Pressure is sum(applications)/sum(capacity) on the same rows with both observed and capacity > 0. Group shares divide observed additive sums by the selected cohort's observed total. Outliers use Q1 - 1.5 IQR and Q3 + 1.5 IQR; they are not source errors.";
export function analysisExport(
  data: AtlasData,
  rows: AtlasItem[],
  config: AnalysisConfig,
) {
  return {
    schemaVersion: 1,
    source: data.source,
    family: data.family,
    filtersAndChart: config,
    reproduciblePath: analysisHref(config, data),
    definitions: data.definitions,
    notices: data.notices,
    methodology: analysisMethodology,
    sourceRowCount: data.items.length,
    selectedRowCount: rows.length,
    coverage: quality(rows),
    records: rows,
  };
}
export const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${(/^[\s\uFEFF]*[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
};
/** Metadata occupies its own typed row, keeping even an empty cohort reproducible. */
export function analysisCsv(
  data: AtlasData,
  rows: AtlasItem[],
  config: AnalysisConfig,
): string {
  const columns = [
    "row_kind",
    "metadata_json",
    "campaign",
    "dataset",
    "release",
    "id",
    "source_formation_id",
    "establishment_id",
    "formation",
    "establishment",
    "city",
    "department",
    "region",
    "type",
    "status",
    "selectivity",
    ...atlasMetricKeys.flatMap((key) => [key, `${key}_state`]),
  ];
  const metadata = {
    ...analysisExport(data, rows, config),
    records: undefined,
  };
  const result: unknown[][] = [columns, ["metadata", JSON.stringify(metadata)]];
  for (const row of rows)
    result.push([
      "record",
      "",
      data.source.campaign,
      data.source.datasetId,
      data.source.releaseId,
      row.id,
      row.sourceFormationId,
      row.establishmentId,
      row.title,
      row.establishment,
      row.city,
      row.department,
      row.region,
      row.type,
      row.status,
      row.selectivity,
      ...atlasMetricKeys.flatMap((key) => [
        row.metrics[key],
        row.states[key] ?? "observed",
      ]),
    ]);
  return (
    "\uFEFF" +
    result
      .map((row) =>
        Array.from({ length: columns.length }, (_, i) => csvCell(row[i])).join(
          ";",
        ),
      )
      .join("\r\n")
  );
}
const xml = (value: unknown) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const shortened = (value: string, length = 34) =>
  value.length > length ? value.slice(0, length - 1) + "…" : value;

/** Standalone vector export; carries all selected records in embedded JSON metadata. */
export function analysisSvg(
  data: AtlasData,
  rows: AtlasItem[],
  config: AnalysisConfig,
): string {
  const meta = analysisExport(data, rows, config);
  const width = 1200,
    height = 780,
    left = 90,
    top = 110,
    plotWidth = 1020,
    plotHeight = 500;
  const parts: string[] = [];
  const text = (
    x: number,
    y: number,
    value: string,
    size = 14,
    anchor = "start",
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${xml(value)}</text>`;
  if (config.view === "scatter") {
    const points = rows
      .map((row) => ({
        row,
        x: measureValue(row, config.x),
        y: measureValue(row, config.y),
        size: measureValue(row, config.size),
      }))
      .filter(
        (point): point is typeof point & { x: number; y: number } =>
          point.x !== null && point.y !== null,
      );
    const maxX = Math.max(1, ...points.map((p) => p.x)),
      maxY = Math.max(1, ...points.map((p) => p.y)),
      maxSize = Math.max(1, ...points.map((p) => p.size ?? 0));
    for (let i = 0; i <= 4; i++) {
      const x = left + (i / 4) * plotWidth,
        y = top + plotHeight - (i / 4) * plotHeight;
      parts.push(
        `<path d="M${left},${y}h${plotWidth}" stroke="#e5e5e5"/>`,
        text(
          left - 12,
          y + 4,
          formatMeasure((maxY * i) / 4, config.y),
          12,
          "end",
        ),
        text(
          x,
          top + plotHeight + 28,
          formatMeasure((maxX * i) / 4, config.x),
          12,
          "middle",
        ),
      );
    }
    for (const point of points)
      parts.push(
        `<circle cx="${left + (point.x / maxX) * plotWidth}" cy="${top + plotHeight - (point.y / maxY) * plotHeight}" r="${point.size === null ? 2.5 : 2.5 + Math.sqrt(point.size / maxSize) * 11}" fill="#292929" fill-opacity=".32"><title>${xml(point.row.title)}</title></circle>`,
      );
    parts.push(
      text(left, top - 20, measureLabels[config.y]),
      text(
        left + plotWidth / 2,
        top + plotHeight + 58,
        measureLabels[config.x],
        14,
        "middle",
      ),
    );
  } else {
    const entries =
      config.view === "distribution"
        ? distribution(rows, config.metric).bins.map((bin) => ({
            label: `${formatBoundary(bin.start, config.metric)} – ${formatBoundary(bin.end, config.metric)}`,
            value: bin.count,
          }))
        : config.view === "quality"
          ? quality(rows).map((row) => ({
              label: measureLabels[row.key],
              value: row.observed,
            }))
          : config.view === "matrix"
            ? matrix(rows, config.dimension, config.column, config.metric)
                .slice(0, 18)
                .map((row) => ({
                  label: `${row.row} / ${row.column}`,
                  value: config.mode === "share" ? row.share : row.value,
                }))
            : grouped(rows, config.dimension, config.metric)
                .slice(0, 18)
                .map((row) => ({
                  label: row.label,
                  value: config.mode === "share" ? row.share : row.value,
                }));
    const max = Math.max(1, ...entries.map((entry) => entry.value ?? 0));
    const barHeight = Math.min(34, plotHeight / Math.max(1, entries.length));
    entries.forEach((entry, i) => {
      const y = top + i * barHeight;
      parts.push(
        text(340, y + 17, shortened(entry.label), 12, "end"),
        `<rect x="355" y="${y}" width="${((entry.value ?? 0) / max) * 640}" height="${barHeight - 7}" rx="3" fill="#3a3a3a"/>`,
        text(
          1010,
          y + 17,
          entry.value === null
            ? "—"
            : new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 1,
              }).format(entry.value),
          12,
        ),
      );
    });
    if (config.view === "matrix")
      parts.push(
        text(
          left,
          652,
          "Aperçu : 18 cellules. Matrice complète et données dans les métadonnées.",
          12,
        ),
      );
    else if (config.view === "concentration")
      parts.push(
        text(
          left,
          652,
          `${dimensionLabels[config.dimension]} · 18 groupes au maximum · ${measureLabels[config.metric]}`,
          12,
        ),
      );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${xml(measureLabels[config.metric])} · ${data.source.campaign}</title><metadata>${xml(JSON.stringify(meta))}</metadata><rect width="100%" height="100%" fill="white"/><g font-family="Arial, sans-serif" fill="#222">${text(40, 42, "Gradavia · " + (config.view === "scatter" ? `${measureLabels[config.y]} × ${measureLabels[config.x]}` : measureLabels[config.metric]), 24)}${text(40, 70, `${data.source.campaign} · ${data.family} · ${rows.length} lignes · ${data.source.datasetId}`, 13)}${parts.join("")}${text(40, 693, shortened(config.annotation, 135), 14)}${text(40, 728, `Source : ${data.source.provider} · ${data.source.license}`, 12)}${text(40, 751, `Version : ${data.source.releaseId} · Définitions, filtres et états des valeurs dans les métadonnées.`, 12)}</g></svg>`;
}
