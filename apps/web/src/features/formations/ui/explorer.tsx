"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/motion/tabs";
import { Table, type TableColumn } from "@/components/motion/table";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import {
  FILTER_KEYS,
  PAGE_SIZE,
  explorerUrl,
  type ExplorerData,
  type ExplorerResult,
  type FilterKey,
  type Formation,
} from "../domain/explorer";
import { formatCount, formationUrl } from "../domain/metrics";
import {
  ComparisonTray,
  ExportButton,
  FormationActions,
  FormationCard,
  MetricValue,
  Reveal,
  SelectField,
  ShareButton,
  SourceDisclosure,
} from "./shared";

const labels: Record<FilterKey, string> = {
  type: "Type de formation",
  region: "Région",
  departement: "Département",
  statut: "Statut de l’établissement",
  selectivite: "Sélectivité",
};
const sortOptions = [
  { value: "nom", label: "Intitulé · A–Z" },
  { value: "capacite", label: "Places · Décroissant" },
  { value: "candidatures", label: "Candidatures · Décroissant" },
  { value: "admis", label: "Admis · Décroissant" },
  { value: "acces", label: "Taux d’accès · Décroissant" },
];

function subscribeMobile(listener: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function ExplorerHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.045em]">
          Explorer les formations
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Campagnes Parcoursup · Formations hors apprentissage
        </p>
      </div>
      {children}
    </div>
  );
}

function ReadyExplorer({
  data,
  initialView,
}: {
  data: ExplorerData;
  initialView?: "liste" | "cartes";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(data.query);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const [selectedView, setSelectedView] = useState<"liste" | "cartes" | null>(
    initialView ?? null,
  );
  const view = selectedView ?? (mobile ? "cartes" : "liste");
  const activeFilters = FILTER_KEYS.filter((key) => data.query[key]);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const navigate = (query = draft, page = 1, nextView = view) => {
    if (pending) return;
    const url = new URL(explorerUrl(query, page), "https://orvio.invalid");
    if (selectedView !== null) url.searchParams.set("vue", nextView);
    startTransition(() => router.push(url.pathname + url.search));
  };
  const changeView = (next: string) => {
    if (pending) return;
    const normalized = next === "cartes" ? "cartes" : "liste";
    setSelectedView(normalized);
    const url = new URL(
      explorerUrl(data.query, data.query.page),
      "https://orvio.invalid",
    );
    url.searchParams.set("vue", normalized);
    window.history.replaceState(null, "", url.pathname + url.search);
  };
  const columns: TableColumn<Formation>[] = [
    {
      key: "title",
      header: "Formation / établissement",
      width: "43%",
      cell: (row) => (
        <div className="min-w-0 py-2">
          <Link
            className="block truncate text-xs font-medium hover:underline"
            href={formationUrl(row.id)}
            title={row.title}
          >
            {row.title}
          </Link>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {row.establishment ?? "Établissement non renseigné"}
          </p>
        </div>
      ),
    },
    {
      key: "city",
      header: "Ville",
      width: "15%",
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground">
          {row.city ?? "Non renseignée"}
        </span>
      ),
    },
    {
      key: "capacity",
      header: "Places",
      width: "10%",
      align: "right",
      cell: (row) => (
        <MetricValue
          metric={row.metrics.capacity}
          metricKey="capacity"
          className="text-xs"
        />
      ),
    },
    {
      key: "applications",
      header: "Candidatures",
      width: "12%",
      align: "right",
      cell: (row) => (
        <MetricValue
          metric={row.metrics.applications}
          metricKey="applications"
          className="text-xs"
        />
      ),
    },
    {
      key: "accessRate",
      header: "Accès",
      width: "10%",
      align: "right",
      cell: (row) => (
        <MetricValue
          metric={row.metrics.accessRate}
          metricKey="accessRate"
          className="text-xs font-medium"
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "88px",
      cell: (row) => (
        <FormationActions formation={row} campaign={data.source.campaign} />
      ),
    },
  ];
  const filters = (
    <div className="grid gap-4 py-2 sm:grid-cols-2 xl:grid-cols-5">
      {FILTER_KEYS.map((key) => {
        const disabled =
          key === "statut"
            ? !data.source.fields.includes("contrat_etab")
            : key === "selectivite"
              ? !data.source.fields.includes("select_form")
              : false;
        const values = [
          ...new Set([
            ...(draft[key] ? [draft[key]] : []),
            ...data.facets[key],
          ]),
        ];
        return (
          <div key={key} className="min-w-0">
            <p className="mb-2 text-[11px] font-medium">{labels[key]}</p>
            <SelectField
              label={labels[key]}
              value={draft[key]}
              onChange={(value) =>
                setDraft((current) => ({ ...current, [key]: value }))
              }
              disabled={disabled || pending}
              options={[
                { value: "", label: "Tous" },
                ...values.map((value) => ({ value, label: value })),
              ]}
            />
            {disabled && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Non publié pour cette campagne.
              </p>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-5">
        <Button
          type="submit"
          size="sm"
          className="rounded-lg"
          disabled={pending}
        >
          Appliquer les filtres
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            navigate({
              ...data.query,
              q: "",
              type: "",
              region: "",
              departement: "",
              statut: "",
              selectivite: "",
              tri: "nom",
            })
          }
        >
          Réinitialiser
        </Button>
      </div>
    </div>
  );
  return (
    <main id="contenu" className="min-w-0 flex-1 py-8" aria-busy={pending}>
      <ExplorerHeader>
        <div className="flex gap-2">
          <ShareButton />
          <ExportButton
            rows={data.formations.map((formation) => ({
              formation,
              source: data.source,
            }))}
            filename={`orvio-parcoursup-${data.source.campaign}-page-${data.query.page}`}
          />
        </div>
      </ExplorerHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate();
        }}
        className="mb-6"
      >
        <div className="flex flex-wrap gap-2">
          <Input
            id="formation-search"
            aria-label="Rechercher une formation, un établissement ou une ville"
            type="search"
            disabled={pending}
            value={draft.q}
            onChange={(q) => setDraft((current) => ({ ...current, q }))}
            maxLength={120}
            placeholder="Formation, établissement, ville…"
            leftIcon={<Search className="size-4" />}
            classNames={{
              root: "min-w-48 flex-1",
              field: "h-11 rounded-lg bg-surface",
              input: "text-sm",
            }}
          />
          <Button
            type="submit"
            className="h-11 rounded-lg px-4"
            disabled={pending}
          >
            Rechercher
          </Button>
          <SelectField
            label="Campagne d’admission"
            disabled={pending}
            value={String(data.source.campaign)}
            onChange={(value) =>
              navigate({
                ...data.query,
                campagne: Number(value),
                q: "",
                tri: "nom",
                type: "",
                region: "",
                departement: "",
                statut: "",
                selectivite: "",
              })
            }
            options={data.campaigns.map((year) => ({
              value: String(year),
              label: `Campagne ${year}`,
            }))}
            className="w-40 shrink-0 [&_button]:h-11"
          />
        </div>
        <BouncyAccordion
          className="mt-3"
          classNames={{
            item: "overflow-visible border border-border rounded-lg bg-surface",
            trigger: "min-h-10 px-3 py-2",
            title: "text-xs font-medium",
            description: "px-3 pb-3",
            content: "overflow-visible",
          }}
          items={[
            {
              id: "filters",
              title: `Filtres${activeFilters.length ? ` · ${activeFilters.length} actifs` : ""}`,
              icon: <SlidersHorizontal className="size-3.5" />,
              description: filters,
            },
          ]}
        />
      </form>
      {activeFilters.length > 0 || data.query.q ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ...(data.query.q
              ? [{ key: "q", label: `« ${data.query.q} »` }]
              : []),
            ...activeFilters.map((key) => ({ key, label: data.query[key] })),
          ].map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant="secondary"
              disabled={pending}
              className="h-7 max-w-full rounded-md px-2 text-[10px]"
              onClick={() => navigate({ ...data.query, [item.key]: "" })}
            >
              <span className="truncate">{item.label}</span>
              <X className="size-3 shrink-0" />
            </Button>
          ))}
        </div>
      ) : null}
      {data.notices.map((notice) => (
        <p
          key={notice}
          role="status"
          className="mb-4 text-xs text-muted-foreground"
        >
          {notice}
        </p>
      ))}
      <Tabs value={view} onValueChange={changeView} variant="segment">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatCount(data.total)} résultat{data.total === 1 ? "" : "s"}
            </span>
            {data.total > 0 ? (
              <span className="ml-2">
                {formatCount((data.query.page - 1) * PAGE_SIZE + 1)}–
                {formatCount(Math.min(data.query.page * PAGE_SIZE, data.total))}
              </span>
            ) : null}
          </p>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <SelectField
              label="Trier les formations"
              disabled={pending}
              value={data.query.tri}
              onChange={(tri) =>
                navigate({ ...data.query, tri: tri as typeof draft.tri })
              }
              options={sortOptions}
              className="w-60 max-w-full shrink-0 [&_button]:h-8 [&_button]:whitespace-nowrap"
            />
            <TabsList className="h-8" wrapperClassName="w-auto shrink-0">
              <TabsTrigger value="liste" disabled={pending}>
                <List className="size-3.5" />
                <span className="sr-only">Vue liste</span>
              </TabsTrigger>
              <TabsTrigger value="cartes" disabled={pending}>
                <LayoutGrid className="size-3.5" />
                <span className="sr-only">Vue cartes</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        {data.total === 0 ? (
          <Reveal className="rounded-xl border border-dashed border-border px-6 py-20 text-center">
            <Search className="mx-auto mb-4 size-6 text-muted-foreground" />
            <h2 className="text-lg font-medium">
              Aucune formation ne correspond à votre recherche.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Essayez un autre intitulé ou élargissez vos filtres.
            </p>
            <Button
              className="mt-5 rounded-lg"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                navigate({
                  ...data.query,
                  q: "",
                  type: "",
                  region: "",
                  departement: "",
                  statut: "",
                  selectivite: "",
                })
              }
            >
              Effacer les filtres
            </Button>
          </Reveal>
        ) : (
          <>
            <TabsContent value="liste">
              <Reveal>
                <Table
                  aria-label="Résultats de la recherche"
                  data={data.formations}
                  columns={columns}
                  getRowId={(row) => row.id}
                  rowHeight={76}
                  height={Math.min(650, data.formations.length * 76 + 48)}
                  className="rounded-xl border-border bg-surface [&_table]:min-w-[720px]"
                />
              </Reveal>
            </TabsContent>
            <TabsContent value="cartes">
              <Reveal className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {data.formations.map((formation) => (
                  <FormationCard
                    key={formation.id}
                    formation={formation}
                    source={data.source}
                  />
                ))}
              </Reveal>
            </TabsContent>
          </>
        )}
      </Tabs>
      {pages > 1 && (
        <nav
          aria-label="Pagination des formations"
          className="mt-5 flex items-center justify-between gap-2"
        >
          <Button
            variant="secondary"
            size="sm"
            className="rounded-lg"
            disabled={data.query.page <= 1 || pending}
            onClick={() => navigate(data.query, data.query.page - 1)}
          >
            <ArrowLeft className="size-3.5" />
            Précédente
          </Button>
          <p className="text-xs tabular-nums text-muted-foreground">
            Page {data.query.page} sur {formatCount(pages)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-lg"
            disabled={data.query.page >= pages || pending}
            onClick={() => navigate(data.query, data.query.page + 1)}
          >
            Suivante
            <ArrowRight className="size-3.5" />
          </Button>
        </nav>
      )}
      <div className="mt-7 flex flex-wrap items-start justify-between gap-3">
        <SourceDisclosure source={data.source} compact />
        <p className="text-[10px] text-muted-foreground">
          Accès : taux officiel · — : non publié
        </p>
      </div>
      <ComparisonTray />
    </main>
  );
}

export function FormationExplorer({
  result,
  retryUrl = "/formations",
  initialView,
}: {
  result: ExplorerResult;
  retryUrl?: string;
  initialView?: "liste" | "cartes";
}) {
  if (result.status === "ready")
    return (
      <ReadyExplorer
        key={explorerUrl(result.data.query, result.data.query.page)}
        data={result.data}
        initialView={initialView}
      />
    );
  return (
    <main id="contenu" className="flex-1 py-8">
      <ExplorerHeader />
      <section className="rounded-xl border border-border bg-surface px-6 py-20 text-center">
        <GraduationCap className="mx-auto mb-5 size-8 text-muted-foreground" />
        <h2 className="text-xl font-medium">
          {result.status === "empty"
            ? "Aucune campagne n’est disponible pour le moment."
            : "Les formations sont temporairement indisponibles."}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {result.status === "empty"
            ? "Les formations seront accessibles dès la publication d’une campagne de données."
            : "La connexion aux données n’a pas pu aboutir. Vous pouvez réessayer dans un instant."}
        </p>
        <ButtonLink
          href={retryUrl}
          variant="secondary"
          className="mt-6 rounded-lg"
        >
          Réessayer
        </ButtonLink>
      </section>
    </main>
  );
}
