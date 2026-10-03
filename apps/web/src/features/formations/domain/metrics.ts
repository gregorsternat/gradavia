import type {
  CampaignSource,
  Formation,
  FormationMetrics,
  Metric,
  MetricKey,
} from "./api-contract";

export const metricLabels: Record<MetricKey, string> = {
  capacity: "Places proposées",
  applications: "Candidatures",
  offers: "Propositions",
  admitted: "Admis",
  accessRate: "Taux d’accès",
  femaleShare: "Femmes parmi les admis",
  scholarshipShare: "Boursiers parmi les néo-bacheliers admis",
  generalBacShare: "Bac général · néo-bacheliers admis",
  technologyBacShare: "Bac technologique · néo-bacheliers admis",
  vocationalBacShare: "Bac professionnel · néo-bacheliers admis",
};
export const percentMetrics = new Set<MetricKey>([
  "accessRate",
  "femaleShare",
  "scholarshipShare",
  "generalBacShare",
  "technologyBacShare",
  "vocationalBacShare",
]);
export const integerFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});
export const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});
export const formatCount = (value: number) => integerFormatter.format(value);
export function formatMetric(metric: Metric, key: MetricKey): string {
  if (metric.state !== "observed" || metric.value === null) {
    return metric.state === "suppressed"
      ? "Masqué"
      : metric.state === "invalid"
        ? "Invalide"
        : "Non publié";
  }
  return `${percentMetrics.has(key) ? decimalFormatter.format(metric.value) : formatCount(metric.value)}${percentMetrics.has(key) ? " %" : ""}`;
}
export function observedMetric(
  metrics: FormationMetrics | null,
  key: MetricKey,
): number | null {
  const metric = metrics?.[key];
  return metric?.state === "observed" ? metric.value : null;
}
export function formationUrl(id: string): string {
  return `/formations/${encodeURIComponent(id)}`;
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Prefix formula-like text before quoting; quoting alone does not stop spreadsheet formula execution.
  const safe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function formationsCsv(
  rows: { formation: Formation; source: CampaignSource }[],
): string {
  const keys = Object.keys(metricLabels) as MetricKey[];
  const header = [
    "Campagne",
    "Formation",
    "Établissement",
    "Ville",
    "Région",
    "Type",
    "Source",
    "Version",
    ...keys.flatMap((key) => [
      metricLabels[key],
      `${metricLabels[key]} : état`,
      `${metricLabels[key]} : champ source`,
    ]),
    "Périmètre et limites",
  ];
  const body = rows.map(({ formation: row, source }) => [
    source.campaign,
    row.title,
    row.establishment,
    row.city,
    row.region,
    row.type,
    source.datasetId,
    source.releaseId,
    ...keys.flatMap((key) => [
      row.metrics[key].value,
      row.metrics[key].state,
      row.metrics[key].sourceField,
    ]),
    "Parcoursup hors apprentissage. Candidatures par formation : une personne peut candidater à plusieurs formations, leur somme ne représente pas des personnes distinctes. Pourcentages de 0 à 100. Le taux d’accès n’est pas une probabilité individuelle d’admission.",
  ]);
  return `\uFEFF${[header, ...body].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
