export const MAX_COMPARISON = 4;
export const MAX_FAVORITES = 100;
export const FAVORITES_PAGE_SIZE = 12;
const validId = /^[0-9a-f-]{36}:[1-9]\d*$/;
export type SavedFormation = {
  id: string;
  campaign: number;
  title: string;
  establishment: string | null;
};
export type SavedSelection = {
  favorites: SavedFormation[];
  comparison: SavedFormation[];
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
        .slice(0, max);
    };
    const data = value as Record<string, unknown>;
    const comparison = valid(data.comparison, MAX_COMPARISON);
    return {
      favorites: valid(data.favorites, MAX_FAVORITES),
      comparison: comparison.filter(
        (row) => row.campaign === comparison[0]?.campaign,
      ),
    };
  } catch {
    return EMPTY_SELECTION;
  }
}
export function toggleSavedSelection(
  current: SavedSelection,
  kind: "favorites" | "comparison",
  row: SavedFormation,
): { selection: SavedSelection; error: string | null } {
  const rows = current[kind];
  if (rows.some((item) => item.id === row.id))
    return {
      selection: {
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
  return { selection: { ...current, [kind]: [...rows, row] }, error: null };
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
