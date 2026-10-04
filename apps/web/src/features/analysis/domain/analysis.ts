import { z } from "zod";
import {
  atlasMetricKeys,
  type AtlasData,
  type AtlasItem,
  type AtlasMetricKey,
} from "../../atlas/domain/api-contract";

export const measureKeys = [...atlasMetricKeys, "pressure", "records"] as const;
export type Measure = (typeof measureKeys)[number];
export const dimensionKeys = [
  "region",
  "department",
  "city",
  "establishment",
  "type",
  "status",
  "selectivity",
] as const;
export type Dimension = (typeof dimensionKeys)[number];
export const dimensionLabels: Record<Dimension, string> = {
  region: "Région",
  department: "Département",
  city: "Commune",
  establishment: "Établissement",
  type: "Filière",
  status: "Statut",
  selectivity: "Sélectivité",
};
export const measureLabels: Record<Measure, string> = {
  capacity: "Places",
  applications: "Candidatures",
  offers: "Propositions",
  admitted: "Admis",
  accessRate: "Taux d’accès",
  femaleShare: "Part de femmes admises",
  scholarshipShare: "Part de boursiers",
  generalBacShare: "Part de bacs généraux",
  technologyBacShare: "Part de bacs technologiques",
  vocationalBacShare: "Part de bacs professionnels",
  localShare: "Recrutement local",
  pressure: "Candidatures / place",
  records: "Formations",
};
export const views = [
  "scatter",
  "distribution",
  "matrix",
  "concentration",
  "quality",
] as const;
export type AnalysisView = (typeof views)[number];
export const configSchema = z.object({
  view: z.enum(views).default("scatter"),
  metric: z.enum(measureKeys).default("capacity"),
  x: z.enum(measureKeys).default("capacity"),
  y: z.enum(measureKeys).default("applications"),
  size: z.enum(measureKeys).default("admitted"),
  dimension: z.enum(dimensionKeys).default("region"),
  column: z.enum(dimensionKeys).default("type"),
  mode: z.enum(["count", "share"]).default("count"),
  region: z.array(z.string().max(200)).max(30).default([]),
  type: z.string().max(200).default(""),
  status: z.string().max(200).default(""),
  search: z.string().max(200).default(""),
  minimum: z.number().finite().nonnegative().nullable().default(null),
  maximum: z.number().finite().nonnegative().nullable().default(null),
  annotation: z.string().max(500).default(""),
});
export type AnalysisConfig = z.infer<typeof configSchema>;
export const defaultConfig = configSchema.parse({});
export const isAdditive = (measure: Measure) =>
  ["records", "capacity", "applications", "offers", "admitted"].includes(
    measure,
  );
export const isPercent = (measure: Measure) =>
  !isAdditive(measure) && measure !== "pressure";
const isOneOf = <T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

export function readConfig(params: URLSearchParams): AnalysisConfig {
  const finite = (key: string) => {
    const text = params.get(key);
    const value = text?.trim() ? Number(text) : NaN;
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const metric = isOneOf(params.get("indicateur"), measureKeys, "capacity");
  const minimum = finite("min");
  const maximum = finite("max");
  return configSchema.parse({
    view: isOneOf(params.get("vue"), views, "scatter"),
    metric,
    x: isOneOf(params.get("x"), measureKeys, "capacity"),
    y: isOneOf(params.get("y"), measureKeys, "applications"),
    size: isOneOf(params.get("taille"), measureKeys, "admitted"),
    dimension: isOneOf(params.get("dimension"), dimensionKeys, "region"),
    column: isOneOf(params.get("colonne"), dimensionKeys, "type"),
    mode:
      isAdditive(metric) && params.get("mode") === "share" ? "share" : "count",
    region: [...new Set(params.getAll("region"))]
      .filter(Boolean)
      .slice(0, 30)
      .map((v) => v.slice(0, 200)),
    type: (params.get("type") ?? "").slice(0, 200),
    status: (params.get("statut") ?? "").slice(0, 200),
    search: (params.get("q") ?? "").slice(0, 200),
    minimum,
    maximum,
    annotation: (params.get("note") ?? "").slice(0, 500),
  });
}

export function analysisHref(
  config: AnalysisConfig,
  data: Pick<AtlasData, "source" | "family">,
): string {
  const p = new URLSearchParams({
    campagne: String(data.source.campaign),
    famille: data.family,
    version: data.source.releaseId,
  });
  const fields = {
    vue: config.view,
    indicateur: config.metric,
    x: config.x,
    y: config.y,
    taille: config.size,
    dimension: config.dimension,
    colonne: config.column,
    mode: config.mode,
    type: config.type,
    statut: config.status,
    q: config.search,
    note: config.annotation,
  };
  for (const [key, value] of Object.entries(fields))
    if (value) p.set(key, value);
  for (const region of config.region) p.append("region", region);
  if (config.minimum !== null) p.set("min", String(config.minimum));
  if (config.maximum !== null) p.set("max", String(config.maximum));
  return `/analyses?${p}`;
}

export function measureValue(item: AtlasItem, key: Measure): number | null {
  if (key === "records") return 1;
  if (key === "pressure") {
    const { applications, capacity } = item.metrics;
    return applications !== null && capacity !== null && capacity > 0
      ? applications / capacity
      : null;
  }
  return item.metrics[key];
}
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLocaleLowerCase("fr");
export function filterItems(
  items: AtlasItem[],
  config: AnalysisConfig,
): AtlasItem[] {
  const words = normalize(config.search).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (config.region.length && !config.region.includes(item.region ?? ""))
      return false;
    if (config.type && config.type !== item.type) return false;
    if (config.status && config.status !== item.status) return false;
    if (words.length) {
      const text = normalize(
        [
          item.title,
          item.establishment,
          item.city,
          item.department,
          item.region,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (!words.every((word) => text.includes(word))) return false;
    }
    if (config.minimum !== null || config.maximum !== null) {
      const value = measureValue(item, config.metric);
      if (
        value === null ||
        (config.minimum !== null && value < config.minimum) ||
        (config.maximum !== null && value > config.maximum)
      )
        return false;
    }
    return true;
  });
}

/** Linear interpolation at (n - 1) p; every source record has equal weight. */
export function quantile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index),
    high = Math.ceil(index);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
}
export function distribution(items: AtlasItem[], key: Measure) {
  const values = items
    .map((item) => measureValue(item, key))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const q1 = quantile(values, 0.25),
    median = quantile(values, 0.5),
    q3 = quantile(values, 0.75);
  const lowerFence = q1 !== null && q3 !== null ? q1 - 1.5 * (q3 - q1) : null;
  const upperFence = q1 !== null && q3 !== null ? q3 + 1.5 * (q3 - q1) : null;
  const outliers =
    lowerFence === null || upperFence === null
      ? []
      : items.filter((item) => {
          const value = measureValue(item, key);
          return value !== null && (value < lowerFence || value > upperFence);
        });
  if (!values.length)
    return {
      observed: 0,
      missing: items.length,
      median,
      q1,
      q3,
      lowerFence,
      upperFence,
      outliers,
      bins: [],
    };
  const min = values[0]!,
    max = values.at(-1)!;
  const count =
    min === max
      ? 1
      : Math.min(12, Math.max(3, Math.ceil(Math.sqrt(values.length))));
  const step = count === 1 ? 1 : (max - min) / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    index,
    start: min + index * step,
    end: index === count - 1 ? max : min + (index + 1) * step,
    count: 0,
    last: index === count - 1,
  }));
  for (const value of values)
    bins[Math.min(count - 1, Math.floor((value - min) / step))]!.count++;
  return {
    observed: values.length,
    missing: items.length - values.length,
    median,
    q1,
    q3,
    lowerFence,
    upperFence,
    outliers,
    bins,
  };
}

export function aggregate(
  items: AtlasItem[],
  key: Measure,
): {
  value: number | null;
  observed: number;
  total: number;
  method: "sum" | "median" | "paired-ratio";
} {
  if (key === "pressure") {
    const pairs = items.filter(
      (item) =>
        item.metrics.capacity !== null &&
        item.metrics.capacity > 0 &&
        item.metrics.applications !== null,
    );
    const capacity = pairs.reduce(
      (sum, item) => sum + item.metrics.capacity!,
      0,
    );
    return {
      value: capacity
        ? pairs.reduce((sum, item) => sum + item.metrics.applications!, 0) /
          capacity
        : null,
      observed: pairs.length,
      total: items.length,
      method: "paired-ratio",
    };
  }
  const values = items
    .map((item) => measureValue(item, key))
    .filter((value): value is number => value !== null);
  const method = isAdditive(key) ? "sum" : "median";
  return {
    value: values.length
      ? method === "sum"
        ? values.reduce((sum, value) => sum + value, 0)
        : quantile(
            values.sort((a, b) => a - b),
            0.5,
          )
      : null,
    observed: values.length,
    total: items.length,
    method,
  };
}
export function grouped(
  items: AtlasItem[],
  dimension: Dimension,
  key: Measure,
) {
  const groups = new Map<string, AtlasItem[]>();
  for (const item of items) {
    const label = item[dimension] ?? "Non renseigné";
    const group = groups.get(label) ?? [];
    group.push(item);
    groups.set(label, group);
  }
  const total = isAdditive(key) ? aggregate(items, key).value : null;
  return [...groups]
    .map(([label, rows]) => {
      const result = aggregate(rows, key);
      return {
        label,
        ...result,
        share:
          total !== null && total > 0 && result.value !== null
            ? (result.value / total) * 100
            : null,
      };
    })
    .sort((a, b) =>
      a.value === null
        ? b.value === null
          ? a.label.localeCompare(b.label, "fr")
          : 1
        : b.value === null
          ? -1
          : b.value - a.value || a.label.localeCompare(b.label, "fr"),
    );
}
export function matrix(
  items: AtlasItem[],
  dimension: Dimension,
  column: Dimension,
  key: Measure,
) {
  const groups = new Map<
    string,
    { row: string; column: string; items: AtlasItem[] }
  >();
  for (const item of items) {
    const row = item[dimension] ?? "Non renseigné",
      col = item[column] ?? "Non renseigné",
      identity = JSON.stringify([row, col]);
    const group = groups.get(identity) ?? { row, column: col, items: [] };
    group.items.push(item);
    groups.set(identity, group);
  }
  const total = isAdditive(key) ? aggregate(items, key).value : null;
  return [...groups.values()]
    .map((group) => {
      const result = aggregate(group.items, key);
      return {
        row: group.row,
        column: group.column,
        ...result,
        share:
          total !== null && total > 0 && result.value !== null
            ? (result.value / total) * 100
            : null,
      };
    })
    .sort(
      (a, b) =>
        a.row.localeCompare(b.row, "fr") ||
        a.column.localeCompare(b.column, "fr"),
    );
}
export function quality(items: AtlasItem[]) {
  return atlasMetricKeys.map((key) => {
    const counts = { observed: 0, missing: 0, suppressed: 0, invalid: 0 };
    for (const item of items)
      counts[
        item.metrics[key] !== null
          ? "observed"
          : (item.states[key] ?? "missing")
      ]++;
    return { key, ...counts };
  });
}

export const savedViewsSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(80),
      href: z
        .string()
        .max(12_000)
        .refine(
          (value) => value.startsWith("/analyses?") && !value.includes("\n"),
        ),
      savedAt: z.string().datetime(),
    }),
  )
  .max(20);
export type SavedView = z.infer<typeof savedViewsSchema>[number];
export function parseSavedViews(value: string | null): SavedView[] {
  if (value === null) return [];
  const result = savedViewsSchema.safeParse(JSON.parse(value));
  if (!result.success) throw new Error("Invalid saved analysis");
  return result.data;
}
export function formatMeasure(value: number | null, key: Measure): string {
  if (value === null) return "—";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: isAdditive(key) ? 0 : 1,
    }).format(value) + (isPercent(key) ? " %" : "")
  );
}
export function formatBoundary(value: number, key: Measure): string {
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value) +
    (isPercent(key) ? " %" : "")
  );
}
export function metricState(item: AtlasItem, key: Measure): string {
  if (key === "records") return "observed";
  if (key === "pressure")
    return measureValue(item, key) === null ? "undefined-ratio" : "observed";
  return item.states[key as AtlasMetricKey] ?? "observed";
}
