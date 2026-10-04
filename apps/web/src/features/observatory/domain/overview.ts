import { z } from "zod";
import { csvCell } from "../../formations/domain/metrics";
import { campaignSourceSchema } from "../../formations/domain/api-contract";

const count = z.number().int().nonnegative();
export const totalSchema = z
  .object({
    value: z.number().nonnegative().nullable(),
    observed: count,
    total: count,
  })
  .refine(
    (v) => v.observed <= v.total && (v.observed === 0) === (v.value === null),
    "Invalid aggregate coverage",
  );
const breakdown = z.object({
  label: z.string(),
  formations: count,
  capacity: totalSchema,
  applications: totalSchema,
  admitted: totalSchema,
});
const overview = z
  .object({
    source: campaignSourceSchema,
    campaigns: z.array(z.number().int()),
    totals: z.object({
      formations: count,
      establishments: count,
      capacity: totalSchema,
      applications: totalSchema,
      admitted: totalSchema,
    }),
    byType: z.array(breakdown),
    byRegion: z.array(breakdown),
    accessDistribution: z.array(
      z.object({ label: z.string(), min: count, max: count, count }),
    ),
    coverage: z.array(
      z.object({
        key: z.string(),
        observed: count,
        missing: count,
        suppressed: count,
        invalid: count,
      }),
    ),
    history: z.array(
      z.object({
        source: campaignSourceSchema,
        campaign: z.number().int(),
        formations: count,
        capacity: totalSchema,
        admitted: totalSchema,
      }),
    ),
    notices: z.array(z.string()),
    requestNotices: z.array(z.string()).default([]),
  })
  .refine(
    (v) =>
      v.campaigns.includes(v.source.campaign) &&
      v.byType.reduce((sum, row) => sum + row.formations, 0) ===
        v.totals.formations &&
      v.byRegion.reduce((sum, row) => sum + row.formations, 0) ===
        v.totals.formations &&
      v.coverage.every(
        (c) =>
          c.observed + c.missing + c.suppressed + c.invalid ===
          v.totals.formations,
      ),
    "Inconsistent overview totals",
  );
export const overviewResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), data: overview }),
  z.object({ status: z.literal("empty") }),
]);
export type OverviewData = z.infer<typeof overview>;
export type Total = z.infer<typeof totalSchema>;
export type Breakdown = z.infer<typeof breakdown>;
export type OverviewResult =
  z.infer<typeof overviewResponse> | { status: "unavailable" };
export type BreakdownMetric =
  "formations" | "capacity" | "applications" | "admitted";
export const number = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
export const compact = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export function metricValue(
  row: Breakdown,
  metric: BreakdownMetric,
): number | null {
  return metric === "formations" ? row.formations : row[metric].value;
}
export function orderBreakdown(
  rows: Breakdown[],
  metric: BreakdownMetric,
): Breakdown[] {
  return [...rows].sort(
    (a, b) =>
      (metricValue(b, metric) ?? -1) - (metricValue(a, metric) ?? -1) ||
      a.label.localeCompare(b.label, "fr"),
  );
}
export function composition(rows: Breakdown[], limit = 5) {
  const sorted = orderBreakdown(rows, "formations");
  const result = sorted
    .slice(0, limit)
    .map((row) => ({ name: row.label, value: row.formations, group: false }));
  const remaining = sorted
    .slice(limit)
    .reduce((sum, row) => sum + row.formations, 0);
  if (remaining > 0)
    result.push({ name: "Autres filières", value: remaining, group: true });
  return result;
}
export function breakdownCsv(
  rows: Breakdown[],
  campaign: number,
  source: { datasetId: string; releaseId: string },
): string {
  const header = [
    "Campagne",
    "Source",
    "Territoire ou filière",
    "Formations",
    "Capacité",
    "Capacité observée (lignes)",
    "Candidatures",
    "Candidatures observées (lignes)",
    "Admis",
    "Admis observés (lignes)",
    "Version",
    "Périmètre",
    "Limites",
  ];
  const values = rows.map((r) => [
    campaign,
    source.datasetId,
    r.label,
    r.formations,
    r.capacity.value,
    r.capacity.observed,
    r.applications.value,
    r.applications.observed,
    r.admitted.value,
    r.admitted.observed,
    source.releaseId,
    "Parcoursup hors apprentissage",
    "Candidatures cumulées par formation, non dédupliquées en personnes. Sommes des valeurs publiées ; couverture indiquée en lignes.",
  ]);
  return (
    "\uFEFF" +
    [header, ...values].map((r) => r.map(csvCell).join(";")).join("\r\n")
  );
}

const dataset = z.object({
  datasetId: z.string(),
  family: z.string(),
  provider: z.string(),
  title: z.string(),
  sourceUrl: z.url().refine((url) => {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "data.enseignementsup-recherche.gouv.fr"
    );
  }),
  status: z.enum(["published", "not-imported"]),
  releaseId: z.uuid().nullable(),
  campaigns: z.array(z.number().int()),
  rowCount: count.nullable(),
  collectedAt: z.iso.datetime().nullable(),
  modifiedAt: z.iso.datetime().nullable(),
  license: z.string().nullable(),
});
export const sourcesResponse = z.object({
  status: z.literal("ready"),
  data: z.object({
    datasets: z.array(dataset),
    totals: z.object({ datasets: count, published: count, records: count }),
    notices: z.array(z.string()),
  }),
});
export type SourcesResult =
  z.infer<typeof sourcesResponse> | { status: "unavailable" };
