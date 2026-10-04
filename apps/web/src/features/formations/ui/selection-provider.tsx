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
import type { Formation } from "../domain/api-contract";
import {
  adoptSharedComparison,
  EMPTY_SELECTION,
  readSavedSelection,
  toggleSavedSelection,
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
        },
      );
      if (error) {
        setMessage(error);
        return;
      }
      const persistent = save(next);
      setMessage(
        persistent
          ? ""
          : "Le stockage de ce navigateur est indisponible. Votre sélection reste disponible dans cet onglet.",
      );
    },
    [],
  );
  return useMemo(
    () => ({
      hydrated,
      favorites: selection.favorites.map((row) => row.id),
      comparison: selection.comparison.map((row) => row.id),
      favoriteRecords: selection.favorites,
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
        const persistent = save(next);
        setMessage(
          persistent
            ? ""
            : "Le stockage de ce navigateur est indisponible. Votre sélection reste disponible dans cet onglet.",
        );
        return true;
      },
      removeFavorite: (id: string) =>
        save({
          ...getSnapshot(),
          favorites: getSnapshot().favorites.filter((row) => row.id !== id),
        }),
      removeComparison: (id: string) =>
        save({
          ...getSnapshot(),
          comparison: getSnapshot().comparison.filter((row) => row.id !== id),
        }),
      clearComparison: () => save({ ...getSnapshot(), comparison: [] }),
      message,
      dismissMessage: () => setMessage(""),
    }),
    [selection, change, message, hydrated],
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
