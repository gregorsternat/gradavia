"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import type { Formation, FormationDetail } from "../domain/api-contract";
import {
  adoptSharedComparison,
  EMPTY_SELECTION,
  readSavedSelection,
  toggleSavedSelection,
  formationSummary,
  MAX_LISTS,
  MAX_FAVORITES,
  MAX_NOTE_LENGTH,
  removeSavedFavorite,
  readSelectionTasks,
  type SelectionNote,
  type SavedFormation,
  type SavedSelection,
} from "../domain/selection";

const STORAGE_KEY = "gradavia.selection.v1";
// Preserve selections saved before the product rename; new writes take precedence.
const LEGACY_STORAGE_KEY = "orvio.selection.v1";
const EVENT = "gradavia-selection-change";
let cachedRaw: string | null = null;
let cachedSelection = EMPTY_SELECTION;
let memoryOnly = false;
function getSnapshot(): SavedSelection {
  if (memoryOnly) return cachedSelection;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSelection = readSavedSelection(raw);
    }
  } catch {
    memoryOnly = true;
  }
  return cachedSelection;
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}
function save(selection: SavedSelection): boolean {
  cachedSelection = selection;
  cachedRaw = JSON.stringify(selection);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(EVENT));
  return !memoryOnly;
}

const noSubscription = () => () => {};
function useSelectionState() {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const selection = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_SELECTION,
  );
  const [message, setMessage] = useState("");
  const persist = useCallback((next: SavedSelection) => {
    const persistent = save(next);
    if (!persistent)
      setMessage(
        "Le stockage de ce navigateur est indisponible. Votre sélection reste disponible dans cet onglet.",
      );
    return persistent;
  }, []);
  const change = useCallback(
    (
      kind: "favorites" | "comparison",
      formation: Formation,
      campaign: number,
    ) => {
      const { selection: next, error } = toggleSavedSelection(
        getSnapshot(),
        kind,
        {
          id: formation.id,
          campaign,
          title: formation.title,
          establishment: formation.establishment,
          summary: formationSummary(formation),
        },
      );
      if (error) {
        setMessage(error);
        return;
      }
      const persistent = persist(next);
      setMessage(
        persistent
          ? ""
          : "Le stockage de ce navigateur est indisponible. Votre sélection reste disponible dans cet onglet.",
      );
    },
    [persist],
  );
  return useMemo(
    () => ({
      hydrated,
      favorites: selection.favorites.map((row) => row.id),
      comparison: selection.comparison.map((row) => row.id),
      favoriteRecords: selection.favorites,
      lists: selection.lists ?? [],
      notes: selection.notes ?? {},
      activeListId: selection.activeListId ?? "",
      comparisonRecords: selection.comparison,
      toggleFavorite: (formation: Formation, campaign: number) =>
        change("favorites", formation, campaign),
      toggleComparison: (formation: Formation, campaign: number) =>
        change("comparison", formation, campaign),
      adoptComparison: (rows: SavedFormation[]) => {
        const { selection: next, error } = adoptSharedComparison(
          getSnapshot(),
          rows,
        );
        if (error) {
          setMessage(error);
          return false;
        }
        const persistent = persist(next);
        setMessage(
          persistent
            ? ""
            : "Le stockage de ce navigateur est indisponible. Votre sélection reste disponible dans cet onglet.",
        );
        return true;
      },
      removeFavorite: (id: string) =>
        persist(removeSavedFavorite(getSnapshot(), id)),
      setActiveList: (id: string) =>
        persist({ ...getSnapshot(), activeListId: id }),
      createList: (name: string) => {
        const current = getSnapshot();
        if (!name.trim() || (current.lists?.length ?? 0) >= MAX_LISTS) {
          setMessage(`Vous pouvez créer jusqu’à ${MAX_LISTS} listes.`);
          return false;
        }
        const id = crypto.randomUUID();
        persist({
          ...current,
          activeListId: id,
          lists: [
            ...(current.lists ?? []),
            { id, name: name.trim().slice(0, 60), ids: [] },
          ],
        });
        return true;
      },
      renameList: (id: string, name: string) => {
        if (name.trim())
          persist({
            ...getSnapshot(),
            lists: getSnapshot().lists?.map((list) =>
              list.id === id
                ? { ...list, name: name.trim().slice(0, 60) }
                : list,
            ),
          });
      },
      deleteList: (id: string) => {
        const current = getSnapshot();
        persist({
          ...current,
          activeListId: current.activeListId === id ? "" : current.activeListId,
          lists: current.lists?.filter((list) => list.id !== id),
        });
      },
      setListMembership: (id: string, listId: string, included: boolean) => {
        const current = getSnapshot();
        persist({
          ...current,
          lists: current.lists?.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  ids: included
                    ? [...new Set([...list.ids, id])]
                    : list.ids.filter((item) => item !== id),
                }
              : list,
          ),
        });
      },
      updateNote: (id: string, note: SelectionNote) => {
        const current = getSnapshot();
        persist({
          ...current,
          notes: {
            ...current.notes,
            [id]: {
              ...note,
              note: note.note.slice(0, MAX_NOTE_LENGTH),
              ...(note.tasks ? { tasks: readSelectionTasks(note.tasks) } : {}),
            },
          },
        });
      },
      rememberDetails: (details: FormationDetail[]) => {
        const current = getSnapshot();
        const lookup = new Map(
          details.map((detail) => [detail.formation.id, detail]),
        );
        const next = {
          ...current,
          favorites: current.favorites.map((row) => {
            const detail = lookup.get(row.id);
            return detail
              ? { ...row, summary: formationSummary(detail.formation, detail) }
              : row;
          }),
        };
        if (
          JSON.stringify(current.favorites) !== JSON.stringify(next.favorites)
        )
          persist(next);
      },
      importList: (
        name: string,
        rows: SavedFormation[],
        notes: Record<string, SelectionNote>,
      ) => {
        const current = getSnapshot();
        const favorites = [
          ...new Map(
            [...current.favorites, ...rows].map((row) => [row.id, row]),
          ).values(),
        ];
        if (
          (current.lists?.length ?? 0) >= MAX_LISTS ||
          favorites.length > MAX_FAVORITES
        ) {
          setMessage(
            `La sélection dépasse la limite de ${MAX_LISTS} listes ou ${MAX_FAVORITES} favoris.`,
          );
          return false;
        }
        const id = crypto.randomUUID();
        persist({
          ...current,
          favorites,
          activeListId: id,
          lists: [
            ...(current.lists ?? []),
            {
              id,
              name: name.trim().slice(0, 60) || "Liste partagée",
              ids: rows.map((row) => row.id),
            },
          ],
          notes: { ...notes, ...current.notes },
        });
        return true;
      },
      removeComparison: (id: string) =>
        persist({
          ...getSnapshot(),
          comparison: getSnapshot().comparison.filter((row) => row.id !== id),
        }),
      clearComparison: () => persist({ ...getSnapshot(), comparison: [] }),
      message,
      dismissMessage: () => setMessage(""),
    }),
    [selection, change, message, hydrated, persist],
  );
}
const SelectionContext = createContext<ReturnType<
  typeof useSelectionState
> | null>(null);
export function FormationSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const selection = useSelectionState();
  return (
    <SelectionContext.Provider value={selection}>
      {children}
      {selection.message && (
        <div
          role="status"
          className="fixed right-5 bottom-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg"
        >
          <p>{selection.message}</p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fermer le message"
            onClick={selection.dismissMessage}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </SelectionContext.Provider>
  );
}
export function useFormationSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("FormationSelectionProvider is required");
  return value;
}
