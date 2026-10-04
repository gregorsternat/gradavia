import type { AtlasData, AtlasItem } from "../../atlas/domain/api-contract";
import { aggregate } from "../../analysis/domain/analysis";

export const evolutionMeasures = [
  "capacity",
  "applications",
  "offers",
  "admitted",
  "records",
] as const;
export type EvolutionMeasure = (typeof evolutionMeasures)[number];
export const cohortLabels = {
  matched: "Identifiants et description inchangés",
  changed: "Description modifiée",
  ambiguous: "Identifiants ambigus",
  entered: "Entrées dans la source",
  exited: "Sorties de la source",
  unidentified: "Identifiants incomplets",
};
type Cohort = keyof typeof cohortLabels;
export type Match = { before: AtlasItem; after: AtlasItem };
export type CompactMatch = {
  title: string;
  sourceFormationId: string | null;
  establishmentId: string | null;
  type: string | null;
  region: string | null;
  before: { id: string; values: (number | null)[]; states: string[] };
  after: { id: string; values: (number | null)[]; states: string[] };
};
export function compactMatches(pairs: Match[]): CompactMatch[] {
  return pairs.map((pair) => ({
    title: pair.after.title,
    sourceFormationId: pair.after.sourceFormationId,
    establishmentId: pair.after.establishmentId,
    type: pair.after.type,
    region: pair.after.region,
    before: {
      id: pair.before.id,
      values: evolutionMeasures.map((key) =>
        key === "records" ? 1 : pair.before.metrics[key],
      ),
      states: evolutionMeasures.map((key) =>
        key === "records"
          ? "observed"
          : (pair.before.states[key] ?? "observed"),
      ),
    },
    after: {
      id: pair.after.id,
      values: evolutionMeasures.map((key) =>
        key === "records" ? 1 : pair.after.metrics[key],
      ),
      states: evolutionMeasures.map((key) =>
        key === "records" ? "observed" : (pair.after.states[key] ?? "observed"),
      ),
    },
  }));
}
const signature = (row: AtlasItem) =>
  JSON.stringify([
    row.title,
    row.establishment,
    row.type,
    row.city,
    row.department,
    row.region,
    row.status,
    row.selectivity,
  ]);
const identity = (row: AtlasItem) =>
  row.sourceFormationId?.trim() && row.establishmentId?.trim()
    ? JSON.stringify([row.sourceFormationId, row.establishmentId])
    : null;

/** Resolve uniqueness on the entire snapshots, before any user filter is applied. */
export function matchSnapshots(before: AtlasData, after: AtlasData) {
  if (before.family !== after.family)
    throw new Error("Source families cannot be matched");
  const index = (rows: AtlasItem[]) => {
    const result = new Map<string, AtlasItem[]>();
    for (const row of rows) {
      const key = identity(row);
      if (key) {
        const group = result.get(key) ?? [];
        group.push(row);
        result.set(key, group);
      }
    }
    return result;
  };
  const left = index(before.items),
    right = index(after.items);
  const beforeGroups = new Map<string, Cohort>(),
    afterGroups = new Map<string, Cohort>();
  const matched: Match[] = [];
  for (const row of before.items)
    if (!identity(row)) beforeGroups.set(row.id, "unidentified");
  for (const row of after.items)
    if (!identity(row)) afterGroups.set(row.id, "unidentified");
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const prior = left.get(key) ?? [],
      next = right.get(key) ?? [];
    const cohort: Cohort =
      prior.length > 1 || next.length > 1
        ? "ambiguous"
        : prior.length === 0
          ? "entered"
          : next.length === 0
            ? "exited"
            : signature(prior[0]!) !== signature(next[0]!)
              ? "changed"
              : "matched";
    for (const row of prior) beforeGroups.set(row.id, cohort);
    for (const row of next) afterGroups.set(row.id, cohort);
    if (cohort === "matched")
      matched.push({ before: prior[0]!, after: next[0]! });
  }
  return { matched, beforeGroups, afterGroups };
}
export function pairedChanges(
  pairs: CompactMatch[],
  measure: EvolutionMeasure,
) {
  const index = evolutionMeasures.indexOf(measure);
  const usable = pairs.flatMap((pair) => {
    const beforeValue = pair.before.values[index] ?? null,
      afterValue = pair.after.values[index] ?? null;
    return beforeValue === null || afterValue === null
      ? []
      : [
          {
            ...pair,
            beforeValue,
            afterValue,
            delta: afterValue - beforeValue,
            index: beforeValue > 0 ? (afterValue / beforeValue) * 100 : null,
            percentChange:
              beforeValue > 0 ? (afterValue / beforeValue - 1) * 100 : null,
          },
        ];
  });
  const ranks = (key: "beforeValue" | "afterValue") => {
    const result = new Map<string, number>();
    const sorted = [...usable].sort((a, b) => b[key] - a[key]);
    let rank = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i]![key] !== sorted[i - 1]![key]) rank = i + 1;
      result.set(sorted[i]!.before.id, rank);
    }
    return result;
  };
  const beforeRanks = ranks("beforeValue"),
    afterRanks = ranks("afterValue");
  return usable
    .map((pair) => ({
      ...pair,
      beforeRank: beforeRanks.get(pair.before.id)!,
      afterRank: afterRanks.get(pair.before.id)!,
      rankChange:
        beforeRanks.get(pair.before.id)! - afterRanks.get(pair.before.id)!,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.delta) - Math.abs(a.delta) ||
        a.title.localeCompare(b.title, "fr"),
    );
}
export function decomposition(
  before: AtlasData,
  after: AtlasData,
  matches: ReturnType<typeof matchSnapshots>,
  measure: EvolutionMeasure,
) {
  return (Object.keys(cohortLabels) as Cohort[]).map((cohort) => {
    const prior = before.items.filter(
        (row) => matches.beforeGroups.get(row.id) === cohort,
      ),
      next = after.items.filter(
        (row) => matches.afterGroups.get(row.id) === cohort,
      );
    const baseline = aggregate(prior, measure),
      current = aggregate(next, measure);
    // An absent cohort is an empty sum of zero; existing rows with no observed
    // metric remain unknown. This distinction makes decomposition auditable.
    const priorValue = prior.length === 0 ? 0 : baseline.value,
      nextValue = next.length === 0 ? 0 : current.value;
    return {
      cohort,
      label: cohortLabels[cohort],
      before: baseline,
      after: current,
      delta:
        priorValue === null || nextValue === null
          ? null
          : nextValue - priorValue,
    };
  });
}
export function pairedGroups(
  pairs: ReturnType<typeof pairedChanges>,
  dimension: "type" | "region",
  indexed: boolean,
) {
  const groups = new Map<
    string,
    { label: string; before: number; after: number; records: number }
  >();
  for (const pair of pairs) {
    const label = pair[dimension] ?? "Non renseigné",
      group = groups.get(label) ?? { label, before: 0, after: 0, records: 0 };
    group.before += pair.beforeValue;
    group.after += pair.afterValue;
    group.records++;
    groups.set(label, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.before - a.before || a.label.localeCompare(b.label, "fr"))
    .map((group) => ({
      ...group,
      baseline: indexed ? (group.before > 0 ? 100 : null) : group.before,
      current: indexed
        ? group.before > 0
          ? (group.after / group.before) * 100
          : null
        : group.after,
    }));
}
export function prepareEvolution(before: AtlasData, after: AtlasData) {
  const resolved = matchSnapshots(before, after);
  const source = (data: AtlasData) => ({
    source: data.source,
    family: data.family,
    campaigns: data.campaigns,
    definitions: data.definitions,
    notices: data.notices,
    records: data.items.length,
  });
  return {
    before: source(before),
    after: source(after),
    matched: compactMatches(resolved.matched),
    contributions: Object.fromEntries(
      evolutionMeasures.map((key) => [
        key,
        decomposition(before, after, resolved, key),
      ]),
    ) as Record<EvolutionMeasure, ReturnType<typeof decomposition>>,
    valueKeys: evolutionMeasures,
  };
}
export type EvolutionData = ReturnType<typeof prepareEvolution>;
