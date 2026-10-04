import { z } from "zod";

export const PAGE_SIZE = 25;
const nullableText = z.string().nullable();
const campaign = z.number().int().min(1000).max(9999);
const query = z.object({
  type: z.string(),
  region: z.string(),
  departement: z.string(),
  statut: z.string(),
  selectivite: z.string(),
  campagne: campaign.nullable(),
  q: z.string(),
  page: z.number().int().min(1).max(999999),
  tri: z.enum(["nom", "capacite", "candidatures", "admis", "acces"]),
});
export const campaignSourceSchema = z.object({
  campaign,
  releaseId: z.uuid(),
  datasetId: z.string().min(1),
  provider: z.string(),
  license: z.string(),
  collectedAt: z.iso.datetime(),
  modifiedAt: z.iso.datetime().nullable(),
  fields: z.array(z.string()),
});
export const formationId = z.string().regex(/^[0-9a-f-]{36}:[1-9]\d*$/);
export const metric = z
  .object({
    value: z.number().finite().nonnegative().nullable(),
    state: z.enum(["observed", "missing", "suppressed", "invalid"]),
    sourceField: z.string(),
  })
  .refine(
    (item) => (item.state === "observed") === (item.value !== null),
    "Inconsistent metric state",
  );
export const metrics = z.object({
  capacity: metric,
  applications: metric,
  offers: metric,
  admitted: metric,
  accessRate: metric,
  femaleShare: metric,
  scholarshipShare: metric,
  generalBacShare: metric,
  technologyBacShare: metric,
  vocationalBacShare: metric,
});
const source = campaignSourceSchema;
const formation = z.object({
  id: formationId,
  sourceFormationId: nullableText,
  metrics,
  title: z.string(),
  establishment: nullableText,
  city: nullableText,
  department: nullableText,
  region: nullableText,
  type: nullableText,
  status: nullableText,
  selectivity: nullableText,
  parcoursupUrl: z
    .string()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.port &&
          (url.hostname === "parcoursup.fr" ||
            url.hostname.endsWith(".parcoursup.fr"))
        );
      } catch {
        return false;
      }
    })
    .nullable(),
});
const facets = z.object({
  type: z.array(z.string()),
  region: z.array(z.string()),
  departement: z.array(z.string()),
  statut: z.array(z.string()),
  selectivite: z.array(z.string()),
});
const data = z
  .object({
    source,
    campaigns: z.array(campaign).min(1),
    query,
    facets,
    formations: z.array(formation).max(PAGE_SIZE),
    total: z.number().int().nonnegative(),
    notices: z.array(z.string()),
  })
  .refine(
    (value) =>
      value.query.campagne === value.source.campaign &&
      value.campaigns.includes(value.source.campaign) &&
      value.query.page <= Math.max(1, Math.ceil(value.total / PAGE_SIZE)) &&
      value.formations.length ===
        Math.min(
          PAGE_SIZE,
          Math.max(0, value.total - (value.query.page - 1) * PAGE_SIZE),
        ) &&
      value.formations.every((row) =>
        row.id.startsWith(`${value.source.releaseId}:`),
      ) &&
      new Set(value.formations.map((row) => row.id)).size ===
        value.formations.length,
    "Inconsistent formation response",
  );

/** Runtime validation of the versioned Rust HTTP boundary, also used in integration tests. */
export const explorerResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), data }),
  z.object({ status: z.literal("empty") }),
]);

export type ExplorerQuery = z.infer<typeof query>;
export type CampaignSource = z.infer<typeof source>;
export type Formation = z.infer<typeof formation>;
export type Facets = z.infer<typeof facets>;
export type ExplorerData = z.infer<typeof data>;
export type ExplorerResult =
  z.infer<typeof explorerResponse> | { status: "unavailable" };

export const detailResponse = z.object({
  status: z.literal("ready"),
  data: z
    .object({
      source,
      formation,
      definitions: z.array(
        z.object({
          key: z.string(),
          field: z.string(),
          label: z.string(),
          unit: z.string(),
          description: z.string(),
        }),
      ),
      history: z.array(
        z.object({
          campaign,
          formationId: formationId.nullable(),
          source,
          metrics: metrics.nullable(),
          continuity: z.enum([
            "same-source-identity",
            "changed-description",
            "ambiguous",
            "missing",
          ]),
        }),
      ),
      notices: z.array(z.string()),
    })
    .refine(
      (value) => value.formation.id.startsWith(`${value.source.releaseId}:`),
      "Inconsistent formation identity",
    ),
});
export type Metric = z.infer<typeof metric>;
export type FormationMetrics = z.infer<typeof metrics>;
export type MetricKey = keyof FormationMetrics;
export type FormationDetail = z.infer<typeof detailResponse>["data"];
export type DetailResult =
  | z.infer<typeof detailResponse>
  | { status: "not-found" }
  | { status: "unavailable" };

/** The App Router can retain percent-encoded dynamic segments during client navigation. */
export function decodeFormationRouteId(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    return formationId.safeParse(decoded).success ? decoded : null;
  } catch {
    return null;
  }
}
