import { z } from "zod";
import {
  campaignSourceSchema,
  formationId,
  metric,
} from "../../formations/domain/api-contract";

export const atlasFamilies = ["parcoursup", "apprentissage", "apb"] as const;
export const atlasFamily = z.enum(atlasFamilies);
export type AtlasFamily = z.infer<typeof atlasFamily>;
export const atlasMetricKeys = [
  "capacity",
  "applications",
  "offers",
  "admitted",
  "accessRate",
  "femaleShare",
  "scholarshipShare",
  "generalBacShare",
  "technologyBacShare",
  "vocationalBacShare",
  "localShare",
] as const;
export type AtlasMetricKey = (typeof atlasMetricKeys)[number];
const metricKey = z.enum(atlasMetricKeys);
const nonObservedState = z.enum(["missing", "suppressed", "invalid"]);
const definition = z.object({
  key: z.string(),
  field: z.string(),
  label: z.string(),
  unit: z.enum(["count", "percent"]),
  description: z.string(),
});
export const atlasItem = z
  .object({
    id: formationId,
    sourceFormationId: z.string().nullable(),
    establishmentId: z.string().nullable(),
    title: z.string(),
    establishment: z.string().nullable(),
    city: z.string().nullable(),
    department: z.string().nullable(),
    region: z.string().nullable(),
    type: z.string().nullable(),
    status: z.string().nullable(),
    selectivity: z.string().nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    metrics: z.record(metricKey, z.number().finite().nonnegative().nullable()),
    states: z.partialRecord(metricKey, nonObservedState),
  })
  .superRefine((row, ctx) => {
    for (const key of atlasMetricKeys) {
      const value = row.metrics[key];
      if ((value === null) !== (row.states[key] !== undefined))
        ctx.addIssue({ code: "custom", message: `Inconsistent ${key} state` });
      if (
        value !== null &&
        (["capacity", "applications", "offers", "admitted"].includes(key)
          ? !Number.isSafeInteger(value)
          : value > 100)
      )
        ctx.addIssue({ code: "custom", message: `Invalid ${key} value` });
    }
    if ((row.latitude === null) !== (row.longitude === null))
      ctx.addIssue({ code: "custom", message: "Incomplete coordinates" });
  });
export type AtlasItem = z.infer<typeof atlasItem>;
const coverage = z.object({
  key: metricKey,
  observed: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
});
export const atlasData = z
  .object({
    source: campaignSourceSchema,
    campaigns: z.array(z.number().int()).min(1),
    family: atlasFamily,
    items: z.array(atlasItem).max(30_000),
    definitions: z.array(definition),
    coverage: z.array(coverage),
    notices: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    if (
      !data.campaigns.includes(data.source.campaign) ||
      new Set(data.items.map((item) => item.id)).size !== data.items.length ||
      data.items.some(
        (item) => !item.id.startsWith(`${data.source.releaseId}:`),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent snapshot identity",
      });
    for (const item of data.coverage)
      if (
        item.observed + item.missing + item.suppressed + item.invalid !==
        data.items.length
      )
        ctx.addIssue({ code: "custom", message: "Inconsistent coverage" });
  });
export type AtlasData = z.infer<typeof atlasData>;
export const atlasResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), data: atlasData }),
  z.object({ status: z.literal("empty") }),
]);
export type AtlasResult =
  | z.infer<typeof atlasResponse>
  | { status: "unavailable" }
  | { status: "not-found" };
const rankGroup = z.object({
  label: z.string().nullable(),
  field: z.string(),
  rank: metric,
});
export const atlasDetailResponse = z.object({
  status: z.literal("ready"),
  data: z
    .object({
      source: campaignSourceSchema,
      family: atlasFamily,
      item: atlasItem,
      metrics: z.record(z.string(), metric),
      definitions: z.array(definition),
      rankGroups: z.array(rankGroup),
      history: z.array(
        z.object({
          source: campaignSourceSchema,
          campaign: z.number().int(),
          formationId: formationId.nullable(),
          continuity: z.enum([
            "same-source-identity",
            "changed-description",
            "ambiguous",
            "missing",
          ]),
          metrics: z.record(z.string(), metric).nullable(),
          rankGroups: z.array(rankGroup),
        }),
      ),
      notices: z.array(z.string()),
    })
    .refine(
      (data) => data.item.id.startsWith(`${data.source.releaseId}:`),
      "Inconsistent detail identity",
    ),
});
export type AtlasDetail = z.infer<typeof atlasDetailResponse>["data"];
export type AtlasDetailResult =
  | z.infer<typeof atlasDetailResponse>
  | { status: "unavailable" }
  | { status: "not-found" };
