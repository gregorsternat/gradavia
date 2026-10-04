import { z } from "zod";
import {
  campaignSourceSchema,
  formationId,
  metric,
} from "../../formations/domain/api-contract";
import { csvCell } from "../../formations/domain/metrics";
import type { SpecialtyIndicator } from "./explorer";
const inverseRow = z.object({
  id: formationId,
  group: z.string(),
  formation: z.string(),
  pair: z.object({
    id: z.string(),
    label: z.string(),
    specialties: z.array(z.string()).length(2),
  }),
  applications: metric,
  offers: metric,
  accepted: metric,
});
export const inverseResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("empty") }),
  z.object({
    status: z.literal("ready"),
    data: z
      .object({
        source: campaignSourceSchema,
        query: z.object({ formation: z.string() }),
        formations: z
          .array(
            z.object({ id: z.string(), group: z.string(), label: z.string() }),
          )
          .max(2000),
        rows: z.array(inverseRow).max(1000),
        notices: z.array(z.string()),
        requestNotices: z.array(z.string()),
      })
      .superRefine((data, ctx) => {
        const selected = data.formations.find(
          (item) => item.id === data.query.formation,
        );
        if (
          data.source.campaign !== 2025 ||
          (data.query.formation && !selected) ||
          (!selected && data.rows.length) ||
          data.rows.some(
            (row) =>
              !row.id.startsWith(`${data.source.releaseId}:`) ||
              row.group !== selected?.group ||
              row.formation !== selected?.label ||
              row.pair.id !== JSON.stringify(row.pair.specialties),
          ) ||
          new Set(data.rows.map((row) => row.id)).size !== data.rows.length
        )
          ctx.addIssue({
            code: "custom",
            message: "Inconsistent inverse specialty response",
          });
      }),
  }),
]);
export type InverseData = Extract<
  z.infer<typeof inverseResponse>,
  { status: "ready" }
>["data"];
export type InverseRow = z.infer<typeof inverseRow>;
export type InverseResult =
  z.infer<typeof inverseResponse> | { status: "unavailable" };
export function inverseUrl(
  formation: string,
  indicator: SpecialtyIndicator = "accepted",
) {
  const params = new URLSearchParams();
  if (formation) params.set("formation", formation);
  if (indicator !== "accepted") params.set("tri", indicator);
  return `/specialites/inverse${params.size ? `?${params}` : ""}`;
}
export function inverseCsv(data: InverseData): string {
  const header = [
    "Campagne",
    "Regroupement",
    "Formation nationale",
    "Combinaison",
    "Candidats avec un vœu confirmé",
    "État vœux",
    "Candidats avec une proposition",
    "État propositions",
    "Candidats avec une acceptation",
    "État acceptations",
    "Jeu source",
    "Version",
    "Ligne source",
    "Périmètre",
  ];
  const rows = data.rows.map((row) => [
    data.source.campaign,
    row.group,
    row.formation,
    row.pair.label,
    row.applications.value,
    row.applications.state,
    row.offers.value,
    row.offers.state,
    row.accepted.value,
    row.accepted.state,
    data.source.datasetId,
    data.source.releaseId,
    row.id,
    "Bacheliers généraux. Libellé national, non un établissement. Ne pas additionner les lignes ou les niveaux.",
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
