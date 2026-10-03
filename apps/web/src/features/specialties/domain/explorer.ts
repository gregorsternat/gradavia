import type {
  CampaignSource,
  Metric,
} from "../../formations/domain/api-contract";
import type { SpecialtyObservation } from "./api-contract";
import { csvCell } from "../../formations/domain/metrics";

export const indicatorLabels = {
  applications: "Vœux confirmés",
  offers: "Avec une proposition",
  accepted: "Avec une acceptation",
} as const;
export type SpecialtyIndicator = keyof typeof indicatorLabels;
export function parseIndicator(
  value: string | string[] | undefined,
): SpecialtyIndicator {
  const input = Array.isArray(value) ? value[0] : value;
  return input === "offers" || input === "accepted" ? input : "applications";
}
export function specialtiesUrl(
  pair: string,
  group = "",
  indicator: SpecialtyIndicator = "applications",
): string {
  const params = new URLSearchParams();
  if (pair) params.set("paire", pair);
  if (group) params.set("groupe", group);
  if (indicator !== "applications") params.set("tri", indicator);
  return `/specialites${params.size ? `?${params}` : ""}`;
}
export function sortObservations(
  rows: SpecialtyObservation[],
  indicator: SpecialtyIndicator,
): SpecialtyObservation[] {
  return [...rows].sort((a, b) => {
    const left = observed(a[indicator]),
      right = observed(b[indicator]);
    if (left === null && right !== null) return 1;
    if (left !== null && right === null) return -1;
    return (
      (right ?? 0) - (left ?? 0) ||
      `${a.group} ${a.formation}`.localeCompare(
        `${b.group} ${b.formation}`,
        "fr",
      )
    );
  });
}
export function observed(metric: Metric): number | null {
  return metric.state === "observed" ? metric.value : null;
}
export function specialtyCsv(
  rows: SpecialtyObservation[],
  source: CampaignSource,
  pair: string,
  level: "national" | "group" | "formation",
): string {
  const keys = Object.keys(indicatorLabels) as SpecialtyIndicator[];
  const header = [
    "Campagne",
    "Combinaison",
    "Niveau",
    "Groupe",
    "Formation",
    "Source",
    "Version",
    ...keys.flatMap((key) => [
      indicatorLabels[key],
      `${indicatorLabels[key]} : état`,
      `${indicatorLabels[key]} : champ source`,
    ]),
    "Unité",
    "Population",
    "Limites d’agrégation",
  ];
  const values = rows.map((row) => [
    source.campaign,
    pair,
    level,
    row.group,
    row.formation,
    source.datasetId,
    source.releaseId,
    ...keys.flatMap((key) => [
      row[key].value,
      row[key].state,
      row[key].sourceField,
    ]),
    "Candidats (effectifs)",
    "Bacheliers généraux de cette combinaison de spécialités, avec au moins un vœu confirmé, une proposition ou une acceptation dans le périmètre de la ligne, selon l’indicateur.",
    "Un candidat peut figurer dans plusieurs groupes ou formations. Ne pas additionner les lignes ni les niveaux.",
  ]);
  return `\uFEFF${[header, ...values].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

const specialtyAliases: Record<string, readonly string[]> = {
  math: ["mathematiques"],
  maths: ["mathematiques"],
  svt: ["sciences", "vie", "terre"],
  nsi: ["numerique", "sciences", "informatique"],
  ses: ["sciences", "economiques", "sociales"],
  hggsp: ["histoire", "geographie", "geopolitique", "politique"],
};
function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Query aliases only affect discovery; source labels and pair identities stay untouched. */
export function matchesSpecialtyPair(
  query: string,
  labels: readonly string[],
): boolean {
  const text = normalizeSearch(labels.join(" "));
  const words = new Set(text.split(" "));
  return normalizeSearch(query)
    .split(" ")
    .every((term) => {
      const expansion = specialtyAliases[term];
      return expansion
        ? words.has(term) || expansion.every((word) => text.includes(word))
        : text.includes(term);
    });
}
