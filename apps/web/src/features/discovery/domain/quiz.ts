import type { AtlasData } from "../../atlas/domain/api-contract";
import { grouped, quality } from "../../analysis/domain/analysis";

export type QuizQuestion = {
  id: string;
  title: string;
  population: string;
  answer: number;
  explanation: string;
  values: { label: string; count: number }[];
  analysis: string;
};
export function sourceQuiz(data: AtlasData): QuizQuestion[] {
  if (!data.items.length) return [];
  const questions: QuizQuestion[] = [];
  const params = new URLSearchParams({
    famille: data.family,
    campagne: String(data.source.campaign),
    version: data.source.releaseId,
  });
  const types = grouped(data.items, "type", "records"),
    lead = types[0];
  if (
    lead?.value !== null &&
    lead?.value !== undefined &&
    lead.label !== "Non renseigné"
  ) {
    questions.push({
      id: "formations",
      title: `Quelle part des formations est classée « ${lead.label} » ?`,
      population: `${data.items.length.toLocaleString("fr")} lignes de formation publiées`,
      answer: (lead.value / data.items.length) * 100,
      explanation: `${lead.value.toLocaleString("fr")} lignes sur ${data.items.length.toLocaleString("fr")} portent ce libellé. Une formation compte une fois, quelle que soit sa capacité ; les doublons source sont conservés.`,
      values: [
        { label: lead.label, count: lead.value },
        { label: "Autres filières", count: data.items.length - lead.value },
      ],
      analysis: `/analyses?${params}&vue=concentration&indicateur=records&dimension=type`,
    });
  }
  const regions = grouped(data.items, "region", "capacity"),
    leadRegion = regions[0];
  const observedCapacity = regions.reduce(
    (sum, region) => sum + (region.value ?? 0),
    0,
  );
  const observedRows = regions.reduce(
    (sum, region) => sum + region.observed,
    0,
  );
  if (
    observedCapacity > 0 &&
    leadRegion?.value !== null &&
    leadRegion?.value !== undefined &&
    leadRegion.label !== "Non renseigné"
  )
    questions.push({
      id: "places",
      title: `Quelle part des places observées se trouve en ${leadRegion.label} ?`,
      population: `${observedRows.toLocaleString("fr")} lignes avec capacité publiée sur ${data.items.length.toLocaleString("fr")}`,
      answer: (leadRegion.value / observedCapacity) * 100,
      explanation: `${leadRegion.value.toLocaleString("fr")} places sur ${observedCapacity.toLocaleString("fr")} places observées. Les capacités absentes sont exclues : ce résultat décrit le total publié, pas une estimation de l’offre manquante.`,
      values: [
        { label: leadRegion.label, count: leadRegion.value },
        { label: "Autres régions", count: observedCapacity - leadRegion.value },
      ],
      analysis: `/analyses?${params}&vue=concentration&indicateur=capacity&dimension=region`,
    });
  const capacity = quality(data.items).find((item) => item.key === "capacity")!;
  questions.push({
    id: "coverage",
    title: "Pour quelle part des formations la capacité est-elle publiée ?",
    population: `${data.items.length.toLocaleString("fr")} lignes de formation`,
    answer: (capacity.observed / data.items.length) * 100,
    explanation: `${capacity.observed.toLocaleString("fr")} valeurs observées, y compris les zéros. Les valeurs absentes (${capacity.missing}), masquées (${capacity.suppressed}) et invalides (${capacity.invalid}) ne sont pas remplacées par zéro.`,
    values: [
      { label: "Observées", count: capacity.observed },
      { label: "Absentes", count: capacity.missing },
      { label: "Masquées", count: capacity.suppressed },
      { label: "Invalides", count: capacity.invalid },
    ],
    analysis: `/analyses?${params}&vue=quality&indicateur=capacity`,
  });
  return questions;
}
