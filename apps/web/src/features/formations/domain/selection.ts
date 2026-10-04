import { z } from "zod";
import {
  campaignSourceSchema,
  metric,
  type Formation,
  type FormationDetail,
} from "./api-contract";

export const MAX_COMPARISON = 4;
export const MAX_FAVORITES = 100;
export const FAVORITES_PAGE_SIZE = 12;
const validId = /^[0-9a-f-]{36}:[1-9]\d*$/;
export type SavedFormation = {
  id: string;
  campaign: number;
  title: string;
  establishment: string | null;
  summary?: SelectionSummary;
};
export const MAX_LISTS = 12;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_CHECKLIST_ITEMS = 20;
export const MAX_TASK_LENGTH = 160;
export const STATUSES = {
  discover: "À découvrir",
  explore: "À approfondir",
  prepared: "Dossier préparé",
} as const;
export type SelectionStatus = keyof typeof STATUSES;
export type SelectionTask = { id: string; label: string; done: boolean };
export type SelectionNote = {
  note: string;
  status: SelectionStatus;
  tasks?: SelectionTask[];
};
export function readSelectionTasks(value: unknown): SelectionTask[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .flatMap((row) => {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,60}$/.test(row.id) ||
        seen.has(row.id) ||
        typeof row.label !== "string" ||
        !row.label.trim() ||
        typeof row.done !== "boolean"
      )
        return [];
      seen.add(row.id);
      return [
        {
          id: row.id,
          label: row.label.trim().slice(0, MAX_TASK_LENGTH),
          done: row.done,
        },
      ];
    })
    .slice(0, MAX_CHECKLIST_ITEMS);
}
export type FormationList = { id: string; name: string; ids: string[] };
const summarySchema = z.object({
  city: z.string().max(500).nullable(),
  region: z.string().max(500).nullable(),
  type: z.string().max(500).nullable(),
  capacity: metric,
  applications: metric,
  accessRate: metric,
  source: campaignSourceSchema.optional(),
});
export type SelectionSummary = z.infer<typeof summarySchema>;
export type SavedSelection = {
  favorites: SavedFormation[];
  comparison: SavedFormation[];
  lists?: FormationList[];
  notes?: Record<string, SelectionNote>;
  activeListId?: string;
};
export const EMPTY_SELECTION: SavedSelection = {
  favorites: [],
  comparison: [],
};

export function parseSelectionIds(
  input: string | string[] | undefined,
  limit = MAX_COMPARISON,
): string[] {
  const raw = Array.isArray(input) ? input.join(",") : (input ?? "");
  return [...new Set(raw.split(",").filter((id) => validId.test(id)))].slice(
    0,
    limit,
  );
}
export function selectionUrl(ids: string[], route = "/comparer"): string {
  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  return `${route}${params.size ? `?${params}` : ""}`;
}
export function readSavedSelection(raw: string | null): SavedSelection {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return EMPTY_SELECTION;
    const valid = (rows: unknown, max: number): SavedFormation[] => {
      if (!Array.isArray(rows)) return [];
      const seen = new Set<string>();
      return rows
        .filter((row): row is SavedFormation => {
          if (
            !row ||
            typeof row !== "object" ||
            typeof row.id !== "string" ||
            !validId.test(row.id) ||
            seen.has(row.id) ||
            !Number.isInteger(row.campaign) ||
            row.campaign < 1000 ||
            row.campaign > 9999 ||
            typeof row.title !== "string" ||
            row.title.length > 2000 ||
            !(
              row.establishment === null ||
              typeof row.establishment === "string"
            )
          )
            return false;
          seen.add(row.id);
          return true;
        })
        .slice(0, max)
        .map((row) => {
          const summary = summarySchema.safeParse(row.summary);
          return {
            id: row.id,
            campaign: row.campaign,
            title: row.title,
            establishment: row.establishment?.slice(0, 2000) ?? null,
            ...(summary.success ? { summary: summary.data } : {}),
          };
        });
    };
    const data = value as Record<string, unknown>;
    const comparison = valid(data.comparison, MAX_COMPARISON);
    const favorites = valid(data.favorites, MAX_FAVORITES);
    const result: SavedSelection = {
      favorites,
      comparison: comparison.filter(
        (row) => row.campaign === comparison[0]?.campaign,
      ),
    };
    if (Array.isArray(data.lists)) {
      const seen = new Set<string>();
      result.lists = data.lists
        .flatMap((item) => {
          if (
            !item ||
            typeof item !== "object" ||
            typeof item.id !== "string" ||
            !/^[a-zA-Z0-9-]{1,60}$/.test(item.id) ||
            seen.has(item.id) ||
            typeof item.name !== "string" ||
            !item.name.trim()
          )
            return [];
          seen.add(item.id);
          return [
            {
              id: item.id,
              name: item.name.trim().slice(0, 60),
              ids: parseSelectionIds(
                Array.isArray(item.ids)
                  ? item.ids.filter((id: unknown) => typeof id === "string")
                  : "",
                MAX_FAVORITES,
              ).filter((id) => favorites.some((row) => row.id === id)),
            },
          ];
        })
        .slice(0, MAX_LISTS);
      if (
        typeof data.activeListId === "string" &&
        result.lists.some((list) => list.id === data.activeListId)
      )
        result.activeListId = data.activeListId;
    }
    if (data.notes && typeof data.notes === "object") {
      result.notes = {};
      for (const row of favorites) {
        const note = (data.notes as Record<string, unknown>)[row.id];
        if (note && typeof note === "object") {
          const entry = note as Record<string, unknown>;
          result.notes[row.id] = {
            note:
              typeof entry.note === "string"
                ? entry.note.slice(0, MAX_NOTE_LENGTH)
                : "",
            status:
              typeof entry.status === "string" &&
              Object.hasOwn(STATUSES, entry.status)
                ? (entry.status as SelectionStatus)
                : "discover",
            ...(Array.isArray(entry.tasks)
              ? { tasks: readSelectionTasks(entry.tasks) }
              : {}),
          };
        }
      }
    }
    return result;
  } catch {
    return EMPTY_SELECTION;
  }
}

export function formationSummary(
  formation: Formation,
  detail?: FormationDetail,
): SelectionSummary {
  return {
    city: formation.city,
    region: formation.region,
    type: formation.type,
    capacity: formation.metrics.capacity,
    applications: formation.metrics.applications,
    accessRate: formation.metrics.accessRate,
    ...(detail ? { source: detail.source } : {}),
  };
}

export function removeSavedFavorite(
  selection: SavedSelection,
  id: string,
): SavedSelection {
  const notes = { ...selection.notes };
  delete notes[id];
  return {
    ...selection,
    favorites: selection.favorites.filter((row) => row.id !== id),
    ...(selection.lists
      ? {
          lists: selection.lists.map((list) => ({
            ...list,
            ids: list.ids.filter((value) => value !== id),
          })),
        }
      : {}),
    ...(selection.notes ? { notes } : {}),
  };
}

export function selectionUpdates(
  detail: FormationDetail,
): { label: string; id: string }[] {
  return detail.history
    .filter(
      (row) =>
        row.formationId &&
        row.formationId !== detail.formation.id &&
        row.continuity === "same-source-identity" &&
        row.campaign > detail.source.campaign,
    )
    .map((row) => ({
      label: `Campagne ${row.campaign} disponible`,
      id: row.formationId!,
    }));
}
export function toggleSavedSelection(
  current: SavedSelection,
  kind: "favorites" | "comparison",
  row: SavedFormation,
): { selection: SavedSelection; error: string | null } {
  const rows = current[kind];
  if (rows.some((item) => item.id === row.id))
    return {
      selection:
        kind === "favorites"
          ? removeSavedFavorite(current, row.id)
          : {
              ...current,
              [kind]: rows.filter((item) => item.id !== row.id),
            },
      error: null,
    };
  if (
    kind === "comparison" &&
    rows.length &&
    rows[0]?.campaign !== row.campaign
  )
    return {
      selection: current,
      error: `La sélection concerne la campagne ${rows[0]?.campaign}. Videz-la pour changer de campagne.`,
    };
  const max = kind === "comparison" ? MAX_COMPARISON : MAX_FAVORITES;
  if (rows.length >= max)
    return {
      selection: current,
      error:
        kind === "comparison"
          ? "Vous pouvez comparer jusqu’à 4 formations."
          : "Vous avez atteint la limite de 100 favoris.",
    };
  return {
    selection: {
      ...current,
      [kind]: [...rows, row],
      ...(kind === "favorites" && current.activeListId
        ? {
            lists: current.lists?.map((list) =>
              list.id === current.activeListId
                ? { ...list, ids: [...list.ids, row.id] }
                : list,
            ),
          }
        : {}),
    },
    error: null,
  };
}

export function adoptSharedComparison(
  current: SavedSelection,
  rows: SavedFormation[],
): { selection: SavedSelection; error: string | null } {
  let selection: SavedSelection = { ...current, comparison: [] };
  const unique = new Map(rows.map((row) => [row.id, row]));
  for (const row of unique.values()) {
    const next = toggleSavedSelection(selection, "comparison", row);
    if (next.error) return { selection: current, error: next.error };
    selection = next.selection;
  }
  return { selection, error: null };
}
