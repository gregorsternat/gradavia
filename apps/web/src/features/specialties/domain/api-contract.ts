import { z } from "zod";
import {
  campaignSourceSchema,
  formationId,
  metric,
} from "../../formations/domain/api-contract";

const pair = z.object({
  id: z.string(),
  label: z.string(),
  specialties: z.array(z.string()),
});
const observation = z.object({
  id: formationId,
  group: z.string(),
  formation: z.string(),
  applications: metric,
  offers: metric,
  accepted: metric,
});
export const specialtyResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("empty") }),
  z.object({
    status: z.literal("ready"),
    data: z
      .object({
        source: campaignSourceSchema,
        campaigns: z.array(z.number().int()),
        query: z.object({ paire: z.string(), groupe: z.string() }),
        pairs: z.array(pair),
        selectedPair: pair,
        national: observation.nullable(),
        groups: z.array(observation),
        formations: z.array(observation),
        definitions: z.array(
          z.object({
            key: z.string(),
            field: z.string(),
            label: z.string(),
            unit: z.literal("count"),
            description: z.string(),
          }),
        ),
        notices: z.array(z.string()),
        requestNotices: z.array(z.string()),
      })
      .refine(
        (data) =>
          data.source.campaign === 2025 &&
          data.campaigns.includes(2025) &&
          data.selectedPair.id === data.query.paire &&
          data.pairs.some((item) => item.id === data.selectedPair.id) &&
          [
            ...data.groups,
            ...data.formations,
            ...(data.national ? [data.national] : []),
          ].every((row) => row.id.startsWith(`${data.source.releaseId}:`)),
        "Inconsistent specialty response",
      ),
  }),
]);
export type SpecialtyData = Extract<
  z.infer<typeof specialtyResponse>,
  { status: "ready" }
>["data"];
export type SpecialtyObservation = z.infer<typeof observation>;
export type SpecialtyPair = z.infer<typeof pair>;
export type SpecialtyResult =
  z.infer<typeof specialtyResponse> | { status: "unavailable" };
