import type { FormationDetail } from "./api-contract";
import { formatCount, observedMetric } from "./metrics";
import {
  MAX_FAVORITES,
  MAX_NOTE_LENGTH,
  STATUSES,
  readSelectionTasks,
  parseSelectionIds,
  selectionUrl,
  type SavedFormation,
  type SelectionNote,
  type SelectionStatus,
} from "./selection";

export const MAX_SHARE_LENGTH = 16000;
export type SharedList = { name: string; notes: Record<string, SelectionNote> };
export function shareListUrl(
  ids: string[],
  name: string,
  notes: Record<string, SelectionNote>,
  includeNotes = false,
): string | null {
  const safeIds = parseSelectionIds(ids, MAX_FAVORITES);
  const url = new URL(
    selectionUrl(safeIds, "/favoris"),
    "https://gradavia.invalid",
  );
  url.searchParams.set("partage", "1");
  const content: SharedList = { name: name.slice(0, 60), notes: {} };
  if (includeNotes)
    for (const id of safeIds)
      if (notes[id])
        content.notes[id] = {
          note: notes[id].note.slice(0, MAX_NOTE_LENGTH),
          status: notes[id].status,
          ...(notes[id].tasks
            ? { tasks: readSelectionTasks(notes[id].tasks) }
            : {}),
        };
  // Fragments keep optional personal notes out of HTTP requests and server logs.
  if (includeNotes) url.hash = encodeURIComponent(JSON.stringify(content));
  const result = url.pathname + url.search + url.hash;
  return result.length <= MAX_SHARE_LENGTH ? result : null;
}

export function readSharedList(hash: string, ids: string[]): SharedList {
  const fallback = { name: "Liste partagée", notes: {} };
  if (!hash || hash.length > MAX_SHARE_LENGTH) return fallback;
  try {
    const value: unknown = JSON.parse(
      decodeURIComponent(hash.replace(/^#/, "")),
    );
    if (!value || typeof value !== "object") return fallback;
    const data = value as Record<string, unknown>;
    const notes: Record<string, SelectionNote> = {};
    if (data.notes && typeof data.notes === "object")
      for (const id of ids) {
        const row = (data.notes as Record<string, unknown>)[id];
        if (!row || typeof row !== "object") continue;
        const entry = row as Record<string, unknown>;
        if (
          typeof entry.note === "string" &&
          entry.note.length <= MAX_NOTE_LENGTH &&
          typeof entry.status === "string" &&
          Object.hasOwn(STATUSES, entry.status)
        )
          notes[id] = {
            note: entry.note,
            status: entry.status as SelectionStatus,
            ...(Array.isArray(entry.tasks)
              ? { tasks: readSelectionTasks(entry.tasks) }
              : {}),
          };
      }
    return {
      name:
        typeof data.name === "string" && data.name.trim()
          ? data.name.trim().slice(0, 60)
          : fallback.name,
      notes,
    };
  } catch {
    return fallback;
  }
}

export function selectionDistribution(
  rows: SavedFormation[],
  dimension: "city" | "region" | "type",
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = row.summary?.[dimension] ?? "Non renseigné";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}

export function concentrationFacts(rows: SavedFormation[]): string[] {
  if (rows.length < 3) return [];
  return (["city", "type"] as const).flatMap((dimension) => {
    const top = selectionDistribution(rows, dimension)[0];
    return top &&
      top.label !== "Non renseigné" &&
      top.count / rows.length >= 0.75
      ? [
          `${top.count} formations sur ${rows.length} ${dimension === "city" ? "à" : "dans la catégorie"} ${top.label}.`,
        ]
      : [];
  });
}

export function demandDistribution(rows: SavedFormation[]) {
  const groups = [
    { label: "Moins de 5 candidatures/place", count: 0 },
    { label: "De 5 à moins de 20", count: 0 },
    { label: "20 ou plus", count: 0 },
    { label: "Non calculable", count: 0 },
  ];
  for (const row of rows) {
    const summary = row.summary;
    const capacity =
      summary?.capacity.state === "observed" ? summary.capacity.value : null;
    const applications =
      summary?.applications.state === "observed"
        ? summary.applications.value
        : null;
    const ratio =
      capacity !== null &&
      capacity !== undefined &&
      capacity > 0 &&
      applications !== null &&
      applications !== undefined
        ? applications / capacity
        : null;
    groups[ratio === null ? 3 : ratio < 5 ? 0 : ratio < 20 ? 1 : 2]!.count++;
  }
  return groups.filter((group) => group.count > 0);
}

export function comparisonComments(
  details: FormationDetail[],
  ids = details.map((detail) => detail.formation.id),
): string[] {
  if (
    details.length < 2 ||
    new Set(details.map((detail) => detail.source.campaign)).size > 1
  )
    return [];
  const comments: string[] = [];
  const capacity = details
    .map((detail) => ({
      value: observedMetric(detail.formation.metrics, "capacity"),
      index: ids.indexOf(detail.formation.id) + 1,
    }))
    .filter(
      (row): row is { value: number; index: number } => row.value !== null,
    )
    .sort((a, b) => a.value - b.value);
  if (capacity.length >= 2) {
    const first = capacity[0]!;
    const last = capacity.at(-1)!;
    comments.push(
      first.value === last.value
        ? `Les ${capacity.length} formations renseignées proposent ${formatCount(first.value)} places chacune.`
        : `La capacité va de ${formatCount(first.value)} places (formation ${first.index}) à ${formatCount(last.value)} (formation ${last.index}).`,
    );
  }
  const places = [
    ...new Set(details.map((detail) => detail.formation.city).filter(Boolean)),
  ];
  if (places.length === 1)
    comments.push(
      `Les formations dont la ville est renseignée se situent à ${places[0]}.`,
    );
  else if (places.length > 1)
    comments.push(
      `La sélection couvre ${places.length} villes : ${places.join(", ")}.`,
    );
  const rates = details
    .map((detail) => ({
      value: observedMetric(detail.formation.metrics, "accessRate"),
      index: ids.indexOf(detail.formation.id) + 1,
    }))
    .filter(
      (row): row is { value: number; index: number } => row.value !== null,
    )
    .sort((a, b) => a.value - b.value);
  if (rates.length >= 2 && rates.at(-1)!.value !== rates[0]!.value)
    comments.push(
      `L’écart de taux d’accès publié atteint ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(rates.at(-1)!.value - rates[0]!.value)} points parmi les ${rates.length} valeurs renseignées.`,
    );
  const profiles = details
    .map((detail) =>
      observedMetric(detail.formation.metrics, "generalBacShare"),
    )
    .filter((value): value is number => value !== null);
  if (profiles.length >= 2 && Math.min(...profiles) !== Math.max(...profiles)) {
    const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
    comments.push(
      `La part de bacheliers généraux parmi les néo-bacheliers admis va de ${format.format(Math.min(...profiles))} à ${format.format(Math.max(...profiles))} % dans les ${profiles.length} formations renseignées.`,
    );
  }
  const demand = details.flatMap((detail) => {
    const capacity = observedMetric(detail.formation.metrics, "capacity");
    const applications = observedMetric(
      detail.formation.metrics,
      "applications",
    );
    return capacity !== null && capacity > 0 && applications !== null
      ? [applications / capacity]
      : [];
  });
  if (demand.length >= 2) {
    const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
    comments.push(
      `La demande observée va de ${format.format(Math.min(...demand))} à ${format.format(Math.max(...demand))} candidatures par place dans les ${demand.length} formations calculables.`,
    );
  }
  return comments;
}
