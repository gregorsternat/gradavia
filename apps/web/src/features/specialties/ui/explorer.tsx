"use client";
import { PanelMain, usePanelPending } from "@/features/workspace/ui/navigation";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "@/features/workspace/ui/navigation";
import Link from "@/features/workspace/ui/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Download,
  Info,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import { Table, type TableColumn } from "@/components/motion/table";
import { Tooltip } from "@/components/motion/tooltip";
import {
  BarChart,
  type TooltipProps,
} from "@/components/charts/tremor/components/BarChart/BarChart";
import {
  formatCount,
  formatMetric,
} from "@/features/formations/domain/metrics";
import { datasetUrl } from "@/features/formations/domain/explorer";
import {
  MetricValue,
  Reveal,
  SelectField,
  ShareButton,
} from "@/features/formations/ui/shared";
import type {
  SpecialtyData,
  SpecialtyObservation,
  SpecialtyResult,
} from "../domain/api-contract";
import {
  indicatorLabels,
  matchesSpecialtyPair,
  observed,
  sortObservations,
  specialtiesUrl,
  specialtyCsv,
  type SpecialtyIndicator,
} from "../domain/explorer";

function subscribeMobile(listener: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function SpecialtyTooltip({ active, payload }: TooltipProps) {
  const row = payload[0];
  if (!active || !row) return null;
  return (
    <div className="max-w-64 rounded-lg border border-border bg-surface px-4 py-3 text-xs shadow-lg">
      <p className="mb-2 leading-5 font-medium">
        {String(row.payload.fullLabel)}
      </p>
      <p className="text-muted-foreground">
        {row.category}
        <span className="ml-4 font-medium tabular-nums text-foreground">
          {formatCount(row.value)}
        </span>
      </p>
    </div>
  );
}
function PairPicker({
  data,
  onChange,
  disabled,
}: {
  data: SpecialtyData;
  onChange: (pair: string) => void;
  disabled: boolean;
}) {
  return (
    <Combobox
      value={data.selectedPair.id}
      onValueChange={onChange}
      disabled={disabled}
      className="max-w-2xl"
      filter={(_, query, keywords) => matchesSpecialtyPair(query, keywords)}
    >
      <ComboboxTrigger className="min-h-12 rounded-xl bg-surface">
        <ComboboxInput
          aria-label="Combinaison de spécialités"
          placeholder="Rechercher une combinaison…"
          className="text-sm"
        />
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxList ariaLabel="Combinaisons de spécialités">
          {data.pairs.map((pair) => (
            <ComboboxItem
              value={pair.id}
              textValue={pair.label}
              key={pair.id}
              className="text-xs leading-5"
            >
              {pair.label}
            </ComboboxItem>
          ))}
          <ComboboxEmpty>Aucune combinaison ne correspond.</ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function ReadySpecialties({
  data,
  initialIndicator,
}: {
  data: SpecialtyData;
  initialIndicator: SpecialtyIndicator;
}) {
  const router = useRouter();
  const [transitionPending, startTransition] = useTransition();
  const panelPending = usePanelPending();
  const pending = transitionPending || panelPending;
  const [indicator, setIndicator] = useState(initialIndicator);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const drilled = Boolean(data.query.groupe);
  const rows = sortObservations(
    drilled ? data.formations : data.groups,
    indicator,
  );
  const observedRows = rows.filter((row) => observed(row[indicator]) !== null);
  const visibleRows = observedRows.slice(0, 10);
  const navigate = (pair: string, group = "") => {
    if (pending) return;
    startTransition(() => router.push(specialtiesUrl(pair, group, indicator)));
  };
  const changeIndicator = (value: string) => {
    if (pending) return;
    const selected = value as SpecialtyIndicator;
    setIndicator(selected);
    router.replaceState(
      null,
      "",
      specialtiesUrl(data.selectedPair.id, data.query.groupe, selected),
    );
  };
  const chartRows = visibleRows.map((row, index) => ({
    index: `${String(index + 1).padStart(2, "0")}  ${(drilled ? row.formation : row.group).slice(0, mobile ? 19 : 30)}${(drilled ? row.formation : row.group).length > (mobile ? 19 : 30) ? "…" : ""}`,
    fullLabel: drilled ? row.formation : row.group,
    group: row.group,
    [indicatorLabels[indicator]]: observed(row[indicator]),
  }));
  const columns: TableColumn<SpecialtyObservation>[] = [
    {
      key: "group",
      header: drilled ? "Formation" : "Groupe de formations",
      width: mobile ? "66%" : "46%",
      cell: (row) =>
        drilled ? (
          <span
            title={row.formation}
            className="line-clamp-3 text-xs leading-5 whitespace-normal"
          >
            {row.formation}
          </span>
        ) : (
          <Link
            href={specialtiesUrl(data.selectedPair.id, row.group, indicator)}
            aria-disabled={pending}
            onNavigate={(event) => {
              event.preventDefault();
              navigate(data.selectedPair.id, row.group);
            }}
            title={row.group}
            className="group flex items-center justify-between gap-2 text-xs leading-5 whitespace-normal"
          >
            <span className="line-clamp-3">{row.group}</span>
            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
          </Link>
        ),
    },
    ...(mobile
      ? [indicator]
      : (Object.keys(indicatorLabels) as SpecialtyIndicator[])
    ).map((key) => ({
      key,
      header: (
        <span className="block text-[10px] leading-4 whitespace-normal">
          {indicatorLabels[key]}
        </span>
      ),
      align: "right" as const,
      cell: (row: SpecialtyObservation) => (
        <MetricValue
          metric={row[key]}
          metricKey="applications"
          className="text-xs"
        />
      ),
    })),
  ];
  const exportRows = () => {
    const body = specialtyCsv(
      rows,
      data.source,
      data.selectedPair.label,
      drilled ? "formation" : "group",
    );
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gradavia-specialites-${data.source.campaign}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sourceDate = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(data.source.collectedAt));
  return (
    <PanelMain id="contenu" className="min-w-0 flex-1 py-8" aria-busy={pending}>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">
            Spécialités du bac
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Destinations Parcoursup des bacheliers généraux ·{" "}
            {data.source.campaign}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/specialites/inverse" variant="secondary" size="sm">
            Partir d’une formation
            <ArrowRight className="size-3.5" />
          </ButtonLink>
          <ShareButton />
        </div>
      </div>
      <section aria-label="Choisir ses spécialités" className="mb-6">
        <p className="mb-2 text-xs font-medium">
          Vos deux spécialités en terminale
        </p>
        <PairPicker
          data={data}
          onChange={(pair) => navigate(pair)}
          disabled={pending}
        />
        <p className="mt-2 text-[10px] text-muted-foreground">
          {data.pairs.length} combinaisons publiées
        </p>
      </section>
      {data.requestNotices.map((notice) => (
        <p
          className="mb-4 text-xs text-muted-foreground"
          key={notice}
          role="status"
        >
          {notice}
        </p>
      ))}
      <Reveal className="mb-5 grid gap-2 sm:mb-7 sm:grid-cols-3 sm:gap-3">
        {(Object.keys(indicatorLabels) as SpecialtyIndicator[]).map((key) => (
          <section
            key={key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border border-border bg-surface p-4 sm:block sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs text-muted-foreground">
                {indicatorLabels[key]}
              </h2>
              <Tooltip
                content={
                  key === "applications"
                    ? "Candidats de cette combinaison ayant confirmé au moins un vœu, au niveau national."
                    : key === "offers"
                      ? "Candidats de cette combinaison ayant reçu au moins une proposition, au niveau national."
                      : "Candidats de cette combinaison ayant accepté au moins une proposition, au niveau national."
                }
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="-my-2 size-6"
                  aria-label={`Définition : ${indicatorLabels[key]}`}
                >
                  <Info className="size-3.5" />
                </Button>
              </Tooltip>
            </div>
            <div className="sm:mt-3">
              {data.national ? (
                <MetricValue
                  metric={data.national[key]}
                  metricKey="applications"
                  animated
                  className="text-2xl font-semibold tracking-[-0.05em] sm:text-3xl"
                />
              ) : (
                <span className="text-2xl text-muted-foreground sm:text-3xl">
                  —
                </span>
              )}
            </div>
            <p className="col-span-2 mt-1 text-[10px] text-muted-foreground sm:mt-2">
              {data.national && data.national[key].state !== "observed"
                ? formatMetric(data.national[key], "applications")
                : "Candidats · périmètre national"}
            </p>
          </section>
        ))}
      </Reveal>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          {drilled && (
            <Link
              href={specialtiesUrl(data.selectedPair.id, "", indicator)}
              aria-disabled={pending}
              onNavigate={(event) => {
                event.preventDefault();
                navigate(data.selectedPair.id);
              }}
              className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              Tous les groupes
            </Link>
          )}
          <h2 className="text-lg font-semibold tracking-tight">
            {drilled ? data.query.groupe : "Vers quelles formations ?"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {rows.length}{" "}
            {drilled
              ? rows.length === 1
                ? "formation"
                : "formations"
              : rows.length === 1
                ? "groupe de formations"
                : "groupes de formations"}{" "}
            · candidatures avec cette combinaison
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SelectField
            label="Indicateur des spécialités"
            disabled={pending}
            value={indicator}
            onChange={changeIndicator}
            options={Object.entries(indicatorLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            className="w-44 [&_button]:h-8"
          />
          <Button
            variant="secondary"
            size="sm"
            className="rounded-lg"
            disabled={!rows.length}
            onClick={exportRows}
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Exporter</span>
            <span className="sr-only sm:hidden">Exporter</span>
          </Button>
        </div>
      </div>
      {rows.length ? (
        <Reveal className="space-y-5">
          <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-xs font-medium">
                {indicatorLabels[indicator]} ·{" "}
                {visibleRows.length < observedRows.length
                  ? "les 10 principaux"
                  : drilled
                    ? "par filière"
                    : "par groupe"}
              </p>
              <span className="text-[10px] text-muted-foreground">
                Candidats
              </span>
            </div>
            {visibleRows.length ? (
              <BarChart
                data={chartRows}
                index="index"
                categories={[indicatorLabels[indicator]]}
                colors={["charcoal"]}
                layout="vertical"
                showLegend={false}
                yAxisWidth={mobile ? 148 : 240}
                allowDecimals={false}
                valueFormatter={(value) =>
                  new Intl.NumberFormat("fr-FR", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
                customTooltip={SpecialtyTooltip}
                className="gradavia-chart"
                style={{ height: Math.max(200, visibleRows.length * 38 + 45) }}
                onValueChange={
                  drilled
                    ? undefined
                    : (event) => {
                        if (typeof event?.group === "string")
                          navigate(data.selectedPair.id, event.group);
                      }
                }
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Aucune valeur observée n’est publiée pour cet indicateur.
              </p>
            )}
            <p className="mt-4 text-[11px] text-muted-foreground">
              Un candidat peut figurer dans plusieurs{" "}
              {drilled ? "filières" : "groupes"}. Ces effectifs ne
              s’additionnent pas.
            </p>
          </section>
          <Table
            aria-label={
              drilled
                ? "Formations par combinaison de spécialités"
                : "Groupes par combinaison de spécialités"
            }
            data={rows}
            columns={columns}
            getRowId={(row) => row.id}
            rowHeight={68}
            height={Math.min(650, rows.length * 68 + 68)}
            className="rounded-xl bg-surface"
          />
        </Reveal>
      ) : (
        <p
          role="status"
          className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground"
        >
          Aucune formation n’est publiée pour cette sélection.
        </p>
      )}
      <BouncyAccordion
        className="mt-6 max-w-3xl"
        classNames={{
          item: "rounded-lg border-0 bg-transparent",
          trigger: "px-0 py-3",
          title: "text-xs",
          description: "px-0 pb-4 text-xs leading-6 text-muted-foreground",
        }}
        items={[
          {
            id: "source",
            title: `Source et périmètre · Spécialités ${data.source.campaign}`,
            description: (
              <div className="space-y-2">
                <p>
                  {data.source.provider} · {data.source.license} · Collecte du{" "}
                  {sourceDate}
                </p>
                <p>
                  Les indicateurs nationaux proviennent du niveau national
                  publié. Les groupes et les formations conservent chacun leur
                  propre population.
                </p>
                <a
                  href={datasetUrl(data.source.datasetId)}
                  className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
                >
                  Consulter le jeu de données
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
            ),
          },
          {
            id: "definitions",
            title: "Définitions et précautions de lecture",
            description: (
              <div className="space-y-4">
                {data.definitions.map((definition) => (
                  <div key={definition.key}>
                    <h3 className="font-medium text-foreground">
                      {definition.label}
                    </h3>
                    <p>{definition.description}</p>
                    <p className="text-[10px]">
                      Champ source : {definition.field}
                    </p>
                  </div>
                ))}
                {data.notices.map((notice) => (
                  <p key={notice}>{notice}</p>
                ))}
                <p>
                  — : non publié · Masqué : valeur masquée par la source ·
                  Invalide : format non conforme. Les effectifs historiques ne
                  prédisent pas votre admission.
                </p>
              </div>
            ),
          },
        ]}
      />
    </PanelMain>
  );
}

export function SpecialtyExplorer({
  result,
  indicator,
}: {
  result: SpecialtyResult;
  indicator: SpecialtyIndicator;
}) {
  if (result.status === "ready")
    return (
      <ReadySpecialties
        key={`${result.data.selectedPair.id}:${result.data.query.groupe}`}
        data={result.data}
        initialIndicator={indicator}
      />
    );
  return (
    <PanelMain id="contenu" className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Spécialités du bac
      </h1>
      <section className="mt-8 rounded-xl border border-border bg-surface px-6 py-20 text-center">
        <BookOpen className="mx-auto mb-5 size-7 text-muted-foreground" />
        <h2 className="text-lg font-medium">
          {result.status === "empty"
            ? "Les données de spécialités ne sont pas encore disponibles."
            : "Les spécialités sont temporairement indisponibles."}
        </h2>
        <ButtonLink
          href="/specialites"
          variant="secondary"
          className="mt-5 rounded-lg"
        >
          Réessayer
        </ButtonLink>
      </section>
    </PanelMain>
  );
}
