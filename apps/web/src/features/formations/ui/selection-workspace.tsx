"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FolderPlus,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Checkbox } from "@/components/motion/checkbox";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import type { DetailResult, FormationDetail } from "../domain/api-contract";
import { formatMetric, formationUrl } from "../domain/metrics";
import {
  FAVORITES_PAGE_SIZE,
  MAX_NOTE_LENGTH,
  MAX_CHECKLIST_ITEMS,
  MAX_TASK_LENGTH,
  STATUSES,
  formationSummary,
  selectionUpdates,
  selectionUrl,
  type SavedFormation,
  type SelectionNote,
} from "../domain/selection";
import {
  concentrationFacts,
  demandDistribution,
  readSharedList,
  selectionDistribution,
  shareListUrl,
} from "../domain/selection-workspace";
import { useFormationSelection } from "./selection-provider";
import {
  ComparisonTray,
  ExportButton,
  FormationCard,
  Reveal,
  SelectField,
} from "./shared";

type LoadedSelection = { id: string; result: DetailResult }[];
const EMPTY_NOTE: SelectionNote = { note: "", status: "discover" };
const emptySubscribe = () => () => {};
function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
function subscribePrint(listener: () => void) {
  const media = window.matchMedia("print");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function SelectionOverview({ rows }: { rows: SavedFormation[] }) {
  const [dimension, setDimension] = useState("region");
  const groups =
    dimension === "demand"
      ? demandDistribution(rows)
      : selectionDistribution(rows, dimension as "region" | "type");
  const facts = concentrationFacts(rows);
  const known = rows.filter((row) => row.summary).length;
  const campaigns = [...new Set(rows.map((row) => row.campaign))].sort();
  if (!rows.length) return null;
  return (
    <section
      aria-label="Répartition de la sélection"
      className="mb-6 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Répartition de la sélection</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length} formations · {campaigns.join(", ")}
            {known < rows.length ? ` · ${known} fiches renseignées` : ""}
          </p>
        </div>
        <SelectField
          label="Répartir la sélection par"
          value={dimension}
          onChange={setDimension}
          options={[
            { value: "region", label: "Territoires" },
            { value: "type", label: "Types de formation" },
            { value: "demand", label: "Candidatures par place" },
          ]}
          className="w-full sm:w-52"
        />
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <BarChart
          data={groups
            .slice(0, 8)
            .map((group) => ({ label: group.label, Formations: group.count }))}
          index="label"
          categories={["Formations"]}
          colors={["charcoal"]}
          layout="vertical"
          className="h-48"
          showLegend={false}
          valueFormatter={(value) =>
            `${value} formation${value > 1 ? "s" : ""}`
          }
          yAxisWidth={150}
        />
        <div className="space-y-3">
          <ul
            aria-label="Effectifs de la sélection"
            className="space-y-2 text-xs"
          >
            {groups.map((group) => (
              <li key={group.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{group.label}</span>
                <span className="tabular-nums">{group.count}</span>
              </li>
            ))}
          </ul>
          {facts.length > 0 && (
            <div className="rounded-lg bg-subtle p-3">
              <p className="mb-1 text-xs font-medium">Sélection concentrée</p>
              {facts.map((fact) => (
                <p
                  key={fact}
                  className="text-xs leading-5 text-muted-foreground"
                >
                  {fact}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
      {groups.length > 8 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Le graphique affiche les 8 groupes les plus représentés. Tous les
          effectifs figurent dans la liste.
        </p>
      )}
      {dimension === "demand" && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Candidatures cumulées / places publiées pour chaque formation, selon
          sa campagne. Ces seuils descriptifs ne mesurent pas une chance
          d’admission.
        </p>
      )}
    </section>
  );
}

function SelectionEditor({
  row,
  detail,
}: {
  row: SavedFormation;
  detail?: FormationDetail;
}) {
  const selection = useFormationSelection();
  const note = selection.notes[row.id] ?? EMPTY_NOTE;
  const [task, setTask] = useState("");
  const tasks = note.tasks ?? [];
  const updates = detail ? selectionUpdates(detail) : [];
  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-xs font-medium">
        {STATUSES[note.status]}
        {note.note ? " · Note enregistrée" : ""}
        {tasks.length
          ? ` · ${tasks.filter((item) => item.done).length}/${tasks.length} démarches`
          : ""}
        {updates.length ? " · Nouvelles données" : ""}
      </summary>
      <div className="mt-4 space-y-4">
        <SelectField
          label={`Suivi de ${row.title}`}
          value={note.status}
          onChange={(status) =>
            selection.updateNote(row.id, {
              ...note,
              status: status as SelectionNote["status"],
            })
          }
          options={Object.entries(STATUSES).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <label className="block text-xs font-medium">
          Notes personnelles
          <textarea
            aria-label={`Notes pour ${row.title}`}
            value={note.note}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) =>
              selection.updateNote(row.id, {
                ...note,
                note: event.target.value,
              })
            }
            placeholder="Questions, points à vérifier…"
            rows={3}
            className="mt-2 block w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-medium">Mes démarches</legend>
          {tasks.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2"
            >
              <Checkbox
                label={item.label}
                checked={item.done}
                onCheckedChange={(done) =>
                  selection.updateNote(row.id, {
                    ...note,
                    tasks: tasks.map((current) =>
                      current.id === item.id ? { ...current, done } : current,
                    ),
                  })
                }
                className="text-xs leading-5"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label={`Retirer la démarche : ${item.label}`}
                onClick={() =>
                  selection.updateNote(row.id, {
                    ...note,
                    tasks: tasks.filter((current) => current.id !== item.id),
                  })
                }
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Input
              label="Nouvelle démarche"
              aria-label={`Nouvelle démarche pour ${row.title}`}
              value={task}
              onChange={setTask}
              maxLength={MAX_TASK_LENGTH}
              className="min-w-0 flex-1"
              classNames={{ field: "rounded-lg", label: "text-xs" }}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!task.trim() || tasks.length >= MAX_CHECKLIST_ITEMS}
              onClick={() => {
                selection.updateNote(row.id, {
                  ...note,
                  tasks: [
                    ...tasks,
                    {
                      id: crypto.randomUUID(),
                      label: task.trim(),
                      done: false,
                    },
                  ],
                });
                setTask("");
              }}
            >
              Ajouter
            </Button>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            Votre liste personnelle. Vérifiez les exigences et les dates auprès
            de la formation.
          </p>
          {detail?.formation.parcoursupUrl && (
            <a
              href={detail.formation.parcoursupUrl}
              className="inline-block text-xs underline underline-offset-4"
            >
              Consulter la fiche officielle
            </a>
          )}
        </fieldset>
        {selection.lists.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium">
              Dans mes listes
            </legend>
            {selection.lists.map((list) => (
              <Checkbox
                key={list.id}
                label={list.name}
                checked={list.ids.includes(row.id)}
                onCheckedChange={(included) =>
                  selection.setListMembership(row.id, list.id, included)
                }
                className="flex text-xs"
              />
            ))}
          </fieldset>
        )}
      </div>
      {updates.length > 0 && (
        <div className="mt-3 space-y-1">
          {updates.map((update) => (
            <Link
              key={update.id}
              href={formationUrl(update.id)}
              className="block text-xs underline underline-offset-4"
            >
              {update.label}
            </Link>
          ))}
        </div>
      )}
    </details>
  );
}

function PrintDossier({
  rows,
  notes,
  name,
  comparison,
}: {
  rows: SavedFormation[];
  notes: Record<string, SelectionNote>;
  name: string;
  comparison: SavedFormation[];
}) {
  return (
    <section id="selection-dossier" className="hidden print:block">
      <style>{`@media print { body * { visibility: hidden !important; } #selection-dossier, #selection-dossier * { visibility: visible !important; } #selection-dossier { position: absolute; inset: 0; display: block !important; padding: 20px; color: #111; background: white; font-size: 11px; } #selection-dossier article { break-inside: avoid; } #selection-dossier a { overflow-wrap: anywhere; } @page { margin: 15mm; } }`}</style>
      <h1 className="text-2xl font-semibold">{name}</h1>
      <p className="mt-2">{rows.length} formations · Dossier Gradavia</p>
      <p className="mt-2">
        Les données ci-dessous sont les versions enregistrées dans cette
        sélection. Les candidatures ne représentent pas des personnes uniques.
        Un taux d’accès publié n’est pas une probabilité individuelle
        d’admission.
      </p>
      {comparison.length > 1 && (
        <section className="mt-6">
          <h2 className="text-base font-semibold">
            Comparaison en cours · Campagne {comparison[0]?.campaign}
          </h2>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr>
                <th className="py-2">Formation</th>
                <th>Places</th>
                <th>Candidatures</th>
                <th>Taux d’accès</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3">
                    {row.title}
                    <br />
                    {row.establishment}
                    <br />
                    <a href={`https://gradavia.com${formationUrl(row.id)}`}>
                      Version {row.id.split(":")[0]}
                    </a>
                  </td>
                  <td>
                    {row.summary
                      ? formatMetric(row.summary.capacity, "capacity")
                      : "Non enregistré"}
                  </td>
                  <td>
                    {row.summary
                      ? formatMetric(row.summary.applications, "applications")
                      : "Non enregistré"}
                  </td>
                  <td>
                    {row.summary
                      ? formatMetric(row.summary.accessRate, "accessRate")
                      : "Non enregistré"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {rows.map((row, index) => (
        <article key={row.id} className="mt-6">
          <h2 className="text-base font-semibold">
            {index + 1}. {row.title}
          </h2>
          <p>
            {row.establishment} · {row.summary?.city ?? "Ville non renseignée"}{" "}
            · Campagne {row.campaign}
          </p>
          {row.summary ? (
            <p className="mt-2">
              Places : {formatMetric(row.summary.capacity, "capacity")} ·
              Candidatures :{" "}
              {formatMetric(row.summary.applications, "applications")} · Taux
              d’accès : {formatMetric(row.summary.accessRate, "accessRate")}
            </p>
          ) : (
            <p className="mt-2">
              Indicateurs non enregistrés. Ouvrez la fiche pour les consulter.
            </p>
          )}
          <p className="mt-2">
            {STATUSES[(notes[row.id] ?? EMPTY_NOTE).status]}
          </p>
          {notes[row.id]?.note && (
            <p className="mt-1 whitespace-pre-wrap">{notes[row.id]!.note}</p>
          )}
          {(notes[row.id]?.tasks?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1">
              {notes[row.id]!.tasks!.map((item) => (
                <li key={item.id}>
                  {item.done ? "Fait" : "À faire"} · {item.label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2">
            Version : {row.id.split(":")[0]}
            {row.summary?.source
              ? ` · ${row.summary.source.provider} · ${row.summary.source.datasetId} · ${row.summary.source.license}`
              : ""}
          </p>
          <a href={`https://gradavia.com${formationUrl(row.id)}`}>
            https://gradavia.com{formationUrl(row.id)}
          </a>
        </article>
      ))}
    </section>
  );
}

export function FavoritesWorkspace({
  results,
  ids,
  page,
  shared = false,
}: {
  results: LoadedSelection;
  ids: string[];
  page: number;
  shared?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selection = useFormationSelection();
  const [listName, setListName] = useState("");
  const printing = useSyncExternalStore(
    subscribePrint,
    () => window.matchMedia("print").matches,
    () => false,
  );
  const [editing, setEditing] = useState<"create" | "rename" | null>(null);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareLink, setShareLink] = useState("");
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const sharedContent = readSharedList(hash, ids);
  const sharedHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const activeList = selection.lists.find(
    (list) => list.id === selection.activeListId,
  );
  const details = results.flatMap(({ result }) =>
    result.status === "ready" ? [result.data] : [],
  );
  const sharedRows: SavedFormation[] = details.map((detail) => ({
    id: detail.formation.id,
    campaign: detail.source.campaign,
    title: detail.formation.title,
    establishment: detail.formation.establishment,
    summary: formationSummary(detail.formation, detail),
  }));
  const rows = shared
    ? sharedRows
    : selection.favoriteRecords.filter(
        (row) => !activeList || activeList.ids.includes(row.id),
      );
  const notes = shared ? sharedContent.notes : selection.notes;
  const name = shared
    ? sharedContent.name
    : (activeList?.name ?? "Mes favoris");
  const pages = Math.max(1, Math.ceil(rows.length / FAVORITES_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = rows.slice(
    (currentPage - 1) * FAVORITES_PAGE_SIZE,
    currentPage * FAVORITES_PAGE_SIZE,
  );
  const localIds = visibleRows.map((row) => row.id).join(",");
  const loadedIds = ids.join(",");
  const hydrated = shared ? sharedHydrated : selection.hydrated;
  useEffect(() => {
    if (
      !shared &&
      selection.hydrated &&
      (localIds !== loadedIds || currentPage !== page)
    ) {
      const url = new URL(
        selectionUrl(localIds ? localIds.split(",") : [], "/favoris"),
        "https://gradavia.invalid",
      );
      if (currentPage > 1) url.searchParams.set("page", String(currentPage));
      startTransition(() =>
        router.replace(url.pathname + url.search, { scroll: false }),
      );
    }
  }, [
    shared,
    selection.hydrated,
    localIds,
    loadedIds,
    currentPage,
    page,
    router,
  ]);
  const rememberDetails = selection.rememberDetails;
  useEffect(() => {
    if (!shared)
      rememberDetails(
        results.flatMap(({ result }) =>
          result.status === "ready" ? [result.data] : [],
        ),
      );
  }, [shared, results, rememberDetails]);
  const changePage = (next: number) => {
    const url = new URL(
      selectionUrl(
        shared
          ? ids
          : rows
              .slice(
                (next - 1) * FAVORITES_PAGE_SIZE,
                next * FAVORITES_PAGE_SIZE,
              )
              .map((row) => row.id),
        "/favoris",
      ),
      "https://gradavia.invalid",
    );
    if (shared) {
      url.searchParams.set("partage", "1");
      url.hash = hash;
    }
    if (next > 1) url.searchParams.set("page", String(next));
    startTransition(() => router.push(url.pathname + url.search + url.hash));
  };
  const visibleResults = shared
    ? results.filter(({ id }) => visibleRows.some((row) => row.id === id))
    : results;
  const ready = shared || localIds === loadedIds;
  return (
    <>
      <main
        id="contenu"
        className="min-w-0 flex-1 py-8 print:hidden"
        aria-busy={pending}
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em]">
              {name}
              <span className="ml-3 align-middle text-lg font-normal text-muted-foreground">
                {rows.length || ""}
              </span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {shared
                ? "Une sélection partagée. Les notes incluses sont visibles par toute personne disposant du lien."
                : "Listes et notes conservées dans ce navigateur."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rows.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                disabled={!hydrated}
              >
                <Printer className="size-3.5" />
                Imprimer le dossier
              </Button>
            )}
            {!shared && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditing("create");
                  setListName("");
                }}
              >
                <FolderPlus className="size-3.5" />
                Nouvelle liste
              </Button>
            )}
            {shared && (
              <Button
                size="sm"
                disabled={!hydrated || details.length !== ids.length}
                onClick={() => {
                  if (selection.importList(name, sharedRows, notes))
                    router.push("/favoris");
                }}
              >
                <Copy className="size-3.5" />
                Enregistrer cette liste
              </Button>
            )}
          </div>
        </div>
        {!shared && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <SelectField
              label="Liste de formations"
              value={selection.activeListId || "all"}
              onChange={(id) => selection.setActiveList(id === "all" ? "" : id)}
              options={[
                {
                  value: "all",
                  label: `Tous les favoris (${selection.favorites.length})`,
                },
                ...selection.lists.map((list) => ({
                  value: list.id,
                  label: `${list.name} (${list.ids.length})`,
                })),
              ]}
              className="w-full sm:w-72"
            />
            {activeList && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Renommer la liste"
                  onClick={() => {
                    setListName(activeList.name);
                    setEditing("rename");
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => selection.deleteList(activeList.id)}
                >
                  <Trash2 className="size-3.5" />
                  Dissoudre la liste
                </Button>
              </>
            )}
            {editing && (
              <form
                className="flex w-full flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (editing === "create") {
                    if (selection.createList(listName)) setEditing(null);
                  } else if (activeList && listName.trim()) {
                    selection.renameList(activeList.id, listName);
                    setEditing(null);
                  }
                }}
              >
                <Input
                  label="Nom de la liste"
                  value={listName}
                  onChange={setListName}
                  maxLength={60}
                  required
                  className="w-full sm:w-72"
                  classNames={{ field: "rounded-lg" }}
                />
                <Button size="sm" type="submit">
                  Enregistrer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                >
                  Annuler
                </Button>
              </form>
            )}
            {activeList && (
              <p className="w-full text-xs text-muted-foreground">
                Les nouveaux favoris rejoignent cette liste. Dissoudre la liste
                conserve les formations dans tous vos favoris.
              </p>
            )}
          </div>
        )}
        {!hydrated || !ready ? (
          <p
            role="status"
            className="py-16 text-center text-sm text-muted-foreground"
          >
            Chargement de vos favoris…
          </p>
        ) : rows.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <h2 className="text-lg font-medium">
              {activeList
                ? "Cette liste est vide"
                : shared
                  ? "Aucune formation disponible"
                  : "Aucune formation enregistrée"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeList
                ? "Ajoutez des favoris ou rangez vos formations depuis « Tous les favoris »."
                : shared && ids.length > 0
                  ? "Les versions demandées sont indisponibles. Réessayez avant d’enregistrer cette liste."
                  : "Enregistrez des formations depuis l’explorateur."}
            </p>
            {shared && ids.length > 0 && (
              <Button
                variant="secondary"
                className="mt-5 mr-3"
                onClick={() => startTransition(() => router.refresh())}
              >
                Réessayer
              </Button>
            )}
            <ButtonLink href="/formations" className="mt-5">
              Explorer les formations
              <ArrowRight className="size-4" />
            </ButtonLink>
          </section>
        ) : (
          <>
            {!printing && <SelectionOverview rows={rows} />}
            {!shared && (
              <details className="mb-6 rounded-xl border border-border bg-surface p-4">
                <summary className="cursor-pointer text-xs font-medium">
                  Partager cette liste
                </summary>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Checkbox
                    label="Inclure mes notes, démarches et suivi"
                    checked={includeNotes}
                    onCheckedChange={(value) => {
                      setIncludeNotes(value);
                      setShareLink("");
                      setShareMessage("");
                    }}
                    className="text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const path = shareListUrl(
                        rows.map((row) => row.id),
                        name,
                        notes,
                        includeNotes,
                      );
                      if (!path) {
                        setShareMessage(
                          "Cette liste contient trop de notes pour un lien. Partagez-la sans notes ou imprimez le dossier.",
                        );
                        return;
                      }
                      const url = window.location.origin + path;
                      setShareLink(url);
                      try {
                        await navigator.clipboard.writeText(url);
                        setShareMessage("Lien copié.");
                      } catch {
                        setShareMessage("Copiez le lien ci-dessous.");
                      }
                    }}
                  >
                    <Copy className="size-3.5" />
                    Copier le lien
                  </Button>
                </div>
                {includeNotes && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Les notes, démarches et statuts seront lisibles par toute
                    personne disposant du lien.
                  </p>
                )}
                {shareMessage && (
                  <p role="status" className="mt-3 text-xs">
                    {shareMessage}
                  </p>
                )}
                {shareLink && (
                  <Input
                    label="Lien de partage"
                    readOnly
                    value={shareLink}
                    className="mt-3"
                    classNames={{ field: "rounded-lg" }}
                  />
                )}
              </details>
            )}
            <Reveal className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleResults.map(({ id, result }) => {
                const row = rows.find((item) => item.id === id);
                return (
                  <div key={id} className="min-w-0 space-y-2">
                    {result.status === "ready" ? (
                      <FormationCard
                        formation={result.data.formation}
                        source={result.data.source}
                        actionsDisabled={pending}
                      />
                    ) : (
                      <section className="rounded-xl border border-border bg-surface p-5">
                        <h2 className="text-sm font-medium">
                          {row?.title ?? "Formation enregistrée"}
                        </h2>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {result.status === "not-found"
                            ? "Cette version des données n’est plus disponible."
                            : "Les données sont temporairement indisponibles."}
                        </p>
                        <div className="mt-4 flex gap-2">
                          {!shared && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => selection.removeFavorite(id)}
                            >
                              Retirer des favoris
                            </Button>
                          )}
                          {result.status === "unavailable" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                startTransition(() => router.refresh())
                              }
                            >
                              Réessayer
                            </Button>
                          )}
                        </div>
                      </section>
                    )}
                    {row &&
                      (!shared ? (
                        <SelectionEditor
                          row={row}
                          detail={
                            result.status === "ready" ? result.data : undefined
                          }
                        />
                      ) : (
                        notes[id] && (
                          <div className="rounded-xl bg-subtle p-4 text-xs">
                            <p className="font-medium">
                              {STATUSES[notes[id]!.status]}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap">
                              {notes[id]!.note}
                            </p>
                            {(notes[id]!.tasks?.length ?? 0) > 0 && (
                              <ul className="mt-3 space-y-2">
                                {notes[id]!.tasks!.map((item) => (
                                  <li key={item.id}>
                                    {item.done ? "Fait" : "À faire"} ·{" "}
                                    {item.label}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      ))}
                  </div>
                );
              })}
            </Reveal>
            {shared && details.length < ids.length && (
              <p role="status" className="mt-4 text-sm text-muted-foreground">
                {ids.length - details.length} formation(s) indisponible(s).
                Réessayez avant d’enregistrer cette liste.
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.refresh()}
                >
                  Réessayer
                </Button>
              </p>
            )}
            {pages > 1 && (
              <nav
                aria-label="Pagination des favoris"
                className="mt-5 flex items-center justify-between"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === 1 || pending}
                  onClick={() => changePage(currentPage - 1)}
                >
                  <ArrowLeft className="size-3.5" />
                  Précédente
                </Button>
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} sur {pages}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === pages || pending}
                  onClick={() => changePage(currentPage + 1)}
                >
                  Suivante
                  <ArrowRight className="size-3.5" />
                </Button>
              </nav>
            )}
            {details.length > 0 && (
              <div className="mt-6">
                <ExportButton
                  rows={details}
                  label={shared ? "Exporter la liste" : "Exporter cette page"}
                  filename="gradavia-favoris"
                />
              </div>
            )}
          </>
        )}
        <ComparisonTray />
      </main>
      <PrintDossier
        rows={rows}
        notes={notes}
        name={name}
        comparison={shared ? [] : selection.comparisonRecords}
      />
    </>
  );
}
