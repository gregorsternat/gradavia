"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { parseSavedViews, type SavedView } from "../domain/analysis";

const key = "gradavia.analyses.v1";
const event = "gradavia-analyses-change";
function subscribe(callback: () => void) {
  const listener = (change: StorageEvent) => {
    if (change.key === key || change.key === null) callback();
  };
  window.addEventListener("storage", listener);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(event, callback);
  };
}
const read = () => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return "unavailable";
  }
};
export function SavedViews({
  href,
  defaultName,
}: {
  href: string;
  defaultName: string;
}) {
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const [memory, setMemory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const parsed = useMemo(() => {
    try {
      return { views: parseSavedViews(memory ?? stored), failed: false };
    } catch {
      return { views: [] as SavedView[], failed: true };
    }
  }, [stored, memory]);
  const write = (views: SavedView[]) => {
    const value = JSON.stringify(views);
    try {
      window.localStorage.setItem(key, value);
      setMemory(null);
      window.dispatchEvent(new Event(event));
      setNotice("Vue enregistrée dans ce navigateur.");
    } catch {
      setMemory(value);
      setNotice(
        "Stockage indisponible : conservé pour cet onglet uniquement. Copiez le lien pour retrouver la vue.",
      );
    }
  };
  return (
    <div className="space-y-4">
      <form
        className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const label = name.trim() || defaultName;
          write(
            [
              { name: label, href, savedAt: new Date().toISOString() },
              ...parsed.views.filter((view) => view.name !== label),
            ].slice(0, 20),
          );
          setName("");
        }}
      >
        <Input
          label="Nom de la vue"
          placeholder={defaultName}
          value={name}
          onChange={setName}
          maxLength={80}
          className="flex-1"
        />
        <Button type="submit" variant="secondary" className="rounded-lg">
          <BookmarkPlus className="size-4" />
          Enregistrer
        </Button>
      </form>
      {(notice || parsed.failed) && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice ||
            "Les vues enregistrées sont illisibles ou le stockage est indisponible. Vous pouvez enregistrer une nouvelle vue ou copier son lien."}
        </p>
      )}
      {parsed.views.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {parsed.views.map((view) => (
            <li
              key={view.name}
              className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle p-2"
            >
              <Link
                href={view.href}
                className="min-w-0 flex-1 truncate px-1 py-2 text-sm hover:underline"
              >
                {view.name}
              </Link>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Supprimer la vue ${view.name}`}
                onClick={() => {
                  write(parsed.views.filter((item) => item.name !== view.name));
                  setNotice("Vue supprimée.");
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        20 vues au maximum, avec leurs filtres, leur annotation et leur version
        de source. Elles restent dans ce navigateur.
      </p>
    </div>
  );
}
