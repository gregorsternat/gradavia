"use client";
import { PanelMain } from "@/features/workspace/ui/navigation";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "@/features/workspace/ui/navigation";
import Link from "@/features/workspace/ui/navigation";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Database,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Checkbox } from "@/components/motion/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/motion/tabs";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Table, type TableColumn } from "@/components/motion/table";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { datasetUrl } from "@/features/formations/domain/explorer";
import { ChartData, Reveal } from "@/features/observatory/ui/shared";
import type {
  AtlasData,
  AtlasItem,
  AtlasResult,
} from "@/features/atlas/domain/api-contract";
import {
  aggregate,
  analysisHref,
  defaultConfig,
  dimensionKeys,
  dimensionLabels,
  distribution,
  filterItems,
  formatBoundary,
  formatMeasure,
  grouped,
  isAdditive,
  matrix,
  measureKeys,
  measureLabels,
  measureValue,
  metricState,
  quality,
  readConfig,
  type AnalysisConfig,
  type Dimension,
  type Measure,
} from "../domain/analysis";
import { analysisCsv, analysisExport, analysisSvg } from "../domain/export";
import { Scatter } from "./scatter";
import { SavedViews } from "./saved-views";
import { ShareButton } from "@/features/formations/ui/shared";

const families = [
  { value: "parcoursup", label: "Parcoursup" },
  { value: "apprentissage", label: "Apprentissage" },
  { value: "apb", label: "Archives APB" },
];
const number = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const dimensions = dimensionKeys.map((value) => ({
  value,
  label: dimensionLabels[value],
}));
const measures = measureKeys.map((value) => ({
  value,
  label: measureLabels[value],
}));
const stateLabels: Record<string, string> = {
  missing: "Absent",
  suppressed: "Masqué",
  invalid: "Invalide",
  "undefined-ratio": "Ratio non calculable",
};
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-9 rounded-lg text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72 overflow-auto">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function recordHref(data: AtlasData, row: AtlasItem) {
  return data.family === "parcoursup"
    ? `/formations/${encodeURIComponent(row.id)}`
    : `/atlas/${encodeURIComponent(row.id)}?famille=${data.family}`;
}

export function AnalysisWorkbench({ result }: { result: AtlasResult }) {
  if (result.status !== "ready")
    return (
      <PanelMain id="contenu" tabIndex={-1} className="py-8">
        <h1 className="page-title">Atelier d’analyse</h1>
        <div className="panel mt-8 flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
          <Database className="size-8 text-muted-foreground" />
          <h2 className="text-lg font-medium">
            {result.status === "not-found"
              ? "Cette version n’est pas disponible"
              : result.status === "empty"
                ? "Aucune campagne publiée dans ce périmètre"
                : "Les données sont temporairement indisponibles"}
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {families.map((family) => (
              <ButtonLink
                key={family.value}
                href={`/analyses?famille=${family.value}`}
                variant="secondary"
                size="sm"
              >
                {family.label}
              </ButtonLink>
            ))}
          </div>
        </div>
      </PanelMain>
    );
  return (
    <Workspace
      key={`${result.data.source.releaseId}:${result.data.source.campaign}`}
      data={result.data}
    />
  );
}

function Workspace({ data }: { data: AtlasData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const config = useMemo(() => readConfig(new URLSearchParams(query)), [query]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(
    () => filterItems(data.items, config),
    [data.items, config],
  );
  const stats = useMemo(
    () => distribution(rows, config.metric),
    [rows, config.metric],
  );
  const groups = useMemo(
    () => grouped(rows, config.dimension, config.metric),
    [rows, config.dimension, config.metric],
  );
  const cells = useMemo(
    () => matrix(rows, config.dimension, config.column, config.metric),
    [rows, config.dimension, config.column, config.metric],
  );
  const coverage = useMemo(() => quality(rows), [rows]);
  const summary = useMemo(
    () => aggregate(rows, config.metric),
    [rows, config.metric],
  );
  const selected = rows.find((row) => row.id === selectedId);
  const regions = useMemo(
    () =>
      [
        ...new Set(
          data.items
            .map((item) => item.region)
            .filter((value): value is string => !!value),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [data.items],
  );
  const types = useMemo(
    () =>
      [
        ...new Set(
          data.items
            .map((item) => item.type)
            .filter((value): value is string => !!value),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [data.items],
  );
  const statuses = useMemo(
    () =>
      [
        ...new Set(
          data.items
            .map((item) => item.status)
            .filter((value): value is string => !!value),
        ),
      ].sort((a, b) => a.localeCompare(b, "fr")),
    [data.items],
  );
  const change = (patch: Partial<AnalysisConfig>) => {
    const next = { ...config, ...patch };
    if (!isAdditive(next.metric)) next.mode = "count";
    if (patch.metric && patch.metric !== config.metric) {
      next.minimum = null;
      next.maximum = null;
    }
    router.replaceState(null, "", analysisHref(next, data));
  };
  const sourceChange = (key: "famille" | "campagne", value: string) => {
    const params = new URLSearchParams({
      famille: data.family,
      campagne: String(data.source.campaign),
    });
    params.set(key, value);
    if (key === "famille") params.delete("campagne");
    router.push(`/analyses?${params}`);
  };
  const filterGroup = (dimension: Dimension, label: string) => {
    if (label === "Non renseigné") return;
    if (dimension === "region") change({ region: [label] });
    if (dimension === "type") change({ type: label });
    if (dimension === "status") change({ status: label });
  };
  const groupFilterable = ["region", "type", "status"].includes(
    config.dimension,
  );
  const href = analysisHref(config, data);
  const measureDefinition =
    config.metric === "records"
      ? "Nombre de lignes de formation dans la source. Les doublons source sont conservés."
      : config.metric === "pressure"
        ? "Somme des candidatures / somme des places, sur les mêmes lignes avec les deux valeurs publiées et une capacité strictement positive. Ce ratio décrit la demande ; ce n’est pas une probabilité d’admission."
        : data.definitions.find(
            (definition) => definition.key === config.metric,
          )?.description;
  const summaryLabel =
    summary.method === "median"
      ? "Médiane des formations"
      : summary.method === "paired-ratio"
        ? "Ratio sur lignes appariées"
        : "Somme observée";
  const topFiveShare =
    isAdditive(config.metric) && summary.value !== null && summary.value > 0
      ? (groups
          .slice(0, 5)
          .reduce((sum, group) => sum + (group.value ?? 0), 0) /
          summary.value) *
        100
      : null;
  const rowColumns: TableColumn<AtlasItem>[] = [
    {
      key: "title",
      header: "Formation",
      width: "330px",
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          onClick={() => setSelectedId(row.id)}
          className="block w-full truncate text-left font-medium hover:underline"
          title={row.title}
        >
          {row.title}
        </button>
      ),
    },
    {
      key: "region",
      header: "Région",
      width: "190px",
      sortable: true,
      cell: (row) => row.region ?? "Non renseigné",
    },
    {
      key: "type",
      header: "Filière",
      width: "160px",
      sortable: true,
      cell: (row) => row.type ?? "Non renseigné",
    },
    ...[...new Set([config.metric, config.x, config.y])].map((key) => ({
      key,
      header: measureLabels[key],
      width: "150px",
      align: "right" as const,
      sortable: true,
      sortValue: (row: AtlasItem) => measureValue(row, key) ?? -1,
      cell: (row: AtlasItem) =>
        measureValue(row, key) === null ? (
          <span className="text-muted-foreground">
            {stateLabels[metricState(row, key)] ?? "Absent"}
          </span>
        ) : (
          formatMeasure(measureValue(row, key), key)
        ),
    })),
    {
      key: "detail",
      header: "Fiche",
      width: "70px",
      cell: (row) => (
        <Link
          href={recordHref(data, row)}
          aria-label={`Ouvrir ${row.title}`}
          className="inline-flex p-2 hover:bg-subtle"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      ),
    },
  ];
  const saveExport = (format: "csv" | "json" | "svg") =>
    download(
      format === "csv"
        ? analysisCsv(data, rows, config)
        : format === "json"
          ? JSON.stringify(analysisExport(data, rows, config), null, 2)
          : analysisSvg(data, rows, config),
      `gradavia-${data.family}-${data.source.campaign}-${config.view}.${format}`,
      format === "csv"
        ? "text/csv;charset=utf-8"
        : format === "json"
          ? "application/json"
          : "image/svg+xml",
    );

  return (
    <PanelMain id="contenu" tabIndex={-1} className="min-w-0 py-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="page-title">Atelier d’analyse</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {number(rows.length)} formations sur {number(data.items.length)} ·{" "}
            {data.source.campaign}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton href={href} />
          {(["csv", "json", "svg"] as const).map((format) => (
            <Button
              key={format}
              variant="ghost"
              size="sm"
              className="h-9 rounded-lg"
              onClick={() => saveExport(format)}
              aria-label={`Exporter l’analyse en ${format.toUpperCase()}`}
            >
              <ArrowDownToLine className="size-3.5" />
              {format.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <section aria-label="Population de l’analyse" className="mt-7 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_.7fr_1.2fr_1.2fr_1.4fr]">
          <Choice
            label="Source"
            value={data.family}
            options={families}
            onChange={(value) => sourceChange("famille", value)}
          />
          <Choice
            label="Campagne"
            value={String(data.source.campaign)}
            options={data.campaigns.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
            onChange={(value) => sourceChange("campagne", value)}
          />
          <Choice
            label="Filière"
            value={config.type}
            options={[
              { value: "", label: "Toutes les filières" },
              ...types.map((value) => ({ value, label: value })),
            ]}
            onChange={(type) => change({ type })}
          />
          <Choice
            label="Statut"
            value={config.status}
            options={[
              { value: "", label: "Tous les statuts" },
              ...statuses.map((value) => ({ value, label: value })),
            ]}
            onChange={(status) => change({ status })}
          />
          <Input
            label="Formation ou établissement"
            value={config.search}
            onChange={(search) => change({ search })}
            placeholder="Rechercher…"
            maxLength={200}
            classNames={{
              label: "text-xs text-muted-foreground",
              field: "min-h-9 h-9 rounded-lg",
              input: "text-xs",
            }}
          />
        </div>
        <BouncyAccordion
          classNames={{
            item: "border-0 bg-transparent shadow-none",
            trigger: "min-h-8 p-0",
            title: "text-xs font-normal",
            content: "px-0",
            description: "px-0 pt-3 pb-1",
          }}
          items={[
            {
              id: "filters",
              title: (
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="size-3.5" />
                  Territoires et plage de valeurs
                  {config.region.length > 0
                    ? ` · ${config.region.length} région${config.region.length > 1 ? "s" : ""}`
                    : ""}
                </span>
              ),
              description: (
                <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                  <fieldset>
                    <legend className="mb-3 text-xs text-muted-foreground">
                      Régions
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {regions.map((region) => (
                        <Checkbox
                          key={region}
                          checked={config.region.includes(region)}
                          onCheckedChange={(checked) =>
                            change({
                              region: checked
                                ? [...config.region, region]
                                : config.region.filter(
                                    (value) => value !== region,
                                  ),
                            })
                          }
                          label={region}
                          className="text-xs"
                        />
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {measureLabels[config.metric]} · valeurs incluses
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        min={0}
                        label="Minimum"
                        value={
                          config.minimum === null ? "" : String(config.minimum)
                        }
                        onChange={(value) =>
                          change({
                            minimum:
                              value.trim() &&
                              Number.isFinite(Number(value)) &&
                              Number(value) >= 0
                                ? Number(value)
                                : null,
                          })
                        }
                      />
                      <Input
                        type="number"
                        min={config.minimum ?? 0}
                        label="Maximum"
                        value={
                          config.maximum === null ? "" : String(config.maximum)
                        }
                        onChange={(value) =>
                          change({
                            maximum:
                              value.trim() &&
                              Number.isFinite(Number(value)) &&
                              Number(value) >= 0
                                ? Number(value)
                                : null,
                          })
                        }
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Les valeurs absentes sont exclues lorsqu’une borne est
                      définie.
                    </p>
                  </div>
                </div>
              ),
            },
          ]}
        />
        {(config.region.length > 0 ||
          config.type ||
          config.status ||
          config.search ||
          config.minimum !== null ||
          config.maximum !== null) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {[
                ...config.region,
                config.type,
                config.status,
                config.search,
                config.minimum !== null || config.maximum !== null
                  ? `${config.minimum ?? "0"} à ${config.maximum ?? "∞"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                change({
                  region: [],
                  type: "",
                  status: "",
                  search: "",
                  minimum: null,
                  maximum: null,
                })
              }
            >
              <X className="size-3" />
              Effacer les filtres
            </Button>
          </div>
        )}
      </section>

      <Reveal className="mt-7 grid gap-4 md:grid-cols-[1fr_1fr_1.5fr]">
        <div className="rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted-foreground">
            {measureLabels[config.metric]} ·{" "}
            {summaryLabel.toLocaleLowerCase("fr")}
          </p>
          <p className="mt-2 text-3xl font-medium tracking-tight tabular-nums">
            {formatMeasure(summary.value, config.metric)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {number(summary.observed)} / {number(summary.total)} valeurs
            utilisables
          </p>
        </div>
        <div className="rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted-foreground">
            Moitié centrale des formations
          </p>
          <p className="mt-2 text-2xl font-medium tracking-tight tabular-nums">
            {formatMeasure(stats.q1, config.metric)}{" "}
            <span className="text-muted-foreground">–</span>{" "}
            {formatMeasure(stats.q3, config.metric)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Premier et troisième quartiles
          </p>
        </div>
        <div className="px-1 py-3">
          <p className="text-sm leading-6">
            {measureDefinition ??
              "Aucune définition de cet indicateur dans cette source."}
          </p>
          {!isAdditive(config.metric) && config.metric !== "pressure" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Médianes entre formations, sans pondération. Elles ne décrivent
              pas la part dans l’ensemble des personnes.
            </p>
          )}
        </div>
      </Reveal>

      <section
        className="panel mt-6 min-w-0 p-4 sm:p-5"
        aria-label="Visualisation de l’analyse"
      >
        <Tabs
          value={config.view}
          onValueChange={(value) =>
            change({ view: value as AnalysisConfig["view"] })
          }
          variant="underline"
        >
          <TabsList aria-label="Représentation">
            <TabsTrigger value="scatter">Nuage de points</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="matrix">Tableau croisé</TabsTrigger>
            <TabsTrigger value="concentration">Concentration</TabsTrigger>
            <TabsTrigger value="quality">Qualité</TabsTrigger>
          </TabsList>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Choice
              label="Indicateur analysé"
              value={config.metric}
              options={measures}
              onChange={(metric) => change({ metric: metric as Measure })}
            />
            {config.view === "scatter" ? (
              <>
                <Choice
                  label="Axe horizontal"
                  value={config.x}
                  options={measures}
                  onChange={(x) => change({ x: x as Measure })}
                />
                <Choice
                  label="Axe vertical"
                  value={config.y}
                  options={measures}
                  onChange={(y) => change({ y: y as Measure })}
                />
                <Choice
                  label="Taille des points"
                  value={config.size}
                  options={measures}
                  onChange={(size) => change({ size: size as Measure })}
                />
              </>
            ) : config.view === "matrix" || config.view === "concentration" ? (
              <>
                <Choice
                  label="Regroupement"
                  value={config.dimension}
                  options={dimensions}
                  onChange={(dimension) =>
                    change({ dimension: dimension as Dimension })
                  }
                />
                {config.view === "matrix" && (
                  <Choice
                    label="Colonnes"
                    value={config.column}
                    options={dimensions}
                    onChange={(column) =>
                      change({ column: column as Dimension })
                    }
                  />
                )}
                <Choice
                  label="Affichage"
                  value={config.mode}
                  options={[
                    {
                      value: "count",
                      label: isAdditive(config.metric)
                        ? "Effectifs"
                        : summaryLabel,
                    },
                    ...(isAdditive(config.metric)
                      ? [{ value: "share", label: "Part du total observé (%)" }]
                      : []),
                  ]}
                  onChange={(mode) =>
                    change({ mode: mode as "count" | "share" })
                  }
                />
              </>
            ) : null}
          </div>
          {rows.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3">
              <p className="text-sm">Aucune formation dans ce périmètre.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => change({ ...defaultConfig, view: config.view })}
              >
                Réinitialiser l’analyse
              </Button>
            </div>
          ) : (
            <>
              <TabsContent value="scatter" keepMounted={false}>
                <Scatter
                  rows={rows}
                  config={config}
                  selectedId={selectedId}
                  onSelect={(row) => setSelectedId(row.id)}
                />
              </TabsContent>
              <TabsContent value="distribution" keepMounted={false}>
                {stats.observed === 0 ? (
                  <EmptyMetric />
                ) : (
                  <>
                    <BarChart
                      className="gradavia-chart h-80"
                      data={stats.bins.map((bin) => ({
                        label: `${formatBoundary(bin.start, config.metric)} – ${formatBoundary(bin.end, config.metric)}${bin.last ? " inclus" : " exclu"}`,
                        Formations: bin.count,
                      }))}
                      index="label"
                      categories={["Formations"]}
                      colors={["charcoal"]}
                      showLegend={false}
                      valueFormatter={number}
                      allowDecimals={false}
                      xAxisLabel={measureLabels[config.metric]}
                    />
                    <p className="mt-4 text-xs text-muted-foreground">
                      {number(stats.observed)} valeurs observées · classes de
                      même largeur, borne haute exclue sauf la dernière.{" "}
                      {number(stats.missing)} valeurs non calculables ou non
                      publiées.
                    </p>
                    <ChartData
                      title="Distribution des formations"
                      data={stats.bins}
                      columns={[
                        {
                          key: "start",
                          header: "De",
                          cell: (row) =>
                            formatBoundary(row.start, config.metric),
                        },
                        {
                          key: "end",
                          header: "À",
                          cell: (row) =>
                            `${formatBoundary(row.end, config.metric)}${row.last ? " inclus" : " exclu"}`,
                        },
                        { key: "count", header: "Formations", align: "right" },
                      ]}
                    />
                  </>
                )}
              </TabsContent>
              <TabsContent value="matrix" keepMounted={false}>
                <MatrixView
                  cells={cells}
                  config={config}
                  onFilter={filterGroup}
                />
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  {summaryLabel}.{" "}
                  {config.mode === "share"
                    ? "Parts du total observé de la sélection."
                    : "Chaque cellule indique sa couverture."}{" "}
                  Les cellules de région, filière ou statut filtrent les autres
                  vues.
                </p>
              </TabsContent>
              <TabsContent value="concentration" keepMounted={false}>
                {summary.observed === 0 ? (
                  <EmptyMetric />
                ) : (
                  <>
                    <BarChart
                      className="gradavia-chart h-96"
                      data={groups.slice(0, 12).map((group) => ({
                        label: group.label,
                        Valeur:
                          config.mode === "share" ? group.share : group.value,
                      }))}
                      index="label"
                      categories={["Valeur"]}
                      colors={["charcoal"]}
                      showLegend={false}
                      valueFormatter={(value) =>
                        config.mode === "share"
                          ? `${number(value)} %`
                          : formatMeasure(value, config.metric)
                      }
                      onValueChange={
                        groupFilterable
                          ? (event) => {
                              if (event && typeof event.label === "string")
                                filterGroup(config.dimension, event.label);
                            }
                          : undefined
                      }
                    />
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      12 premiers groupes sur {groups.length}.{" "}
                      {topFiveShare !== null
                        ? `Les ${Math.min(5, groups.length)} premiers représentent ${number(topFiveShare)} % du total observé.`
                        : "Les statistiques de taux ne s’additionnent pas."}{" "}
                      {groupFilterable
                        ? "Sélectionnez une barre pour filtrer toutes les vues."
                        : "La liste complète est disponible ci-dessous."}
                    </p>
                    <ChartData
                      title="Répartition complète"
                      data={groups}
                      columns={[
                        {
                          key: "label",
                          header: dimensionLabels[config.dimension],
                        },
                        {
                          key: "value",
                          header: summaryLabel,
                          align: "right",
                          cell: (row) =>
                            formatMeasure(row.value, config.metric),
                        },
                        {
                          key: "share",
                          header: "Part du total",
                          align: "right",
                          cell: (row) =>
                            row.share === null ? "—" : `${number(row.share)} %`,
                        },
                        {
                          key: "observed",
                          header: "Couverture",
                          align: "right",
                          cell: (row) => `${row.observed} / ${row.total}`,
                        },
                      ]}
                    />
                  </>
                )}
              </TabsContent>
              <TabsContent value="quality" keepMounted={false}>
                <BarChart
                  className="gradavia-chart h-96"
                  data={coverage.map((item) => ({
                    label: measureLabels[item.key],
                    Observé: item.observed,
                    Absent: item.missing,
                    Masqué: item.suppressed,
                    Invalide: item.invalid,
                  }))}
                  index="label"
                  categories={["Observé", "Absent", "Masqué", "Invalide"]}
                  colors={["charcoal", "pale", "silver", "steel"]}
                  type="stacked"
                  valueFormatter={number}
                  allowDecimals={false}
                />
                <ChartData
                  title="États des valeurs"
                  data={coverage}
                  columns={[
                    {
                      key: "key",
                      header: "Indicateur",
                      cell: (row) => measureLabels[row.key],
                    },
                    { key: "observed", header: "Observé", align: "right" },
                    { key: "missing", header: "Absent", align: "right" },
                    { key: "suppressed", header: "Masqué", align: "right" },
                    { key: "invalid", header: "Invalide", align: "right" },
                  ]}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
        <div className="mt-5">
          <Input
            label="Annotation de la vue"
            placeholder="Ajouter une observation à conserver et partager…"
            value={config.annotation}
            onChange={(annotation) => change({ annotation })}
            maxLength={500}
            classNames={{
              label: "text-xs text-muted-foreground",
              input: "text-xs",
            }}
          />
        </div>
      </section>

      {selected && (
        <section
          className="mt-5 rounded-xl bg-subtle p-5"
          aria-label="Formation sélectionnée"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {selected.type} · {selected.city ?? selected.region}
              </p>
              <h2 className="mt-2 font-medium">{selected.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.establishment}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Fermer la sélection"
              onClick={() => setSelectedId(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {[...new Set([config.x, config.y, config.metric])].map((key) => (
              <p key={key} className="text-sm">
                <span className="text-muted-foreground">
                  {measureLabels[key]}{" "}
                </span>
                {formatMeasure(measureValue(selected, key), key)}
              </p>
            ))}
            <ButtonLink
              href={recordHref(data, selected)}
              size="sm"
              variant="secondary"
            >
              Ouvrir la fiche
              <ArrowUpRight className="size-3.5" />
            </ButtonLink>
          </div>
        </section>
      )}

      <section className="mt-7" aria-label="Formations de la sélection">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">Les formations</h2>
          <span className="text-xs text-muted-foreground">
            {number(rows.length)} lignes
          </span>
        </div>
        <Table
          aria-label="Formations de l’analyse"
          data={rows}
          columns={rowColumns}
          getRowId={(row) => row.id}
          rowHeight={44}
          height={Math.min(450, rows.length * 44 + 50)}
          className="text-xs"
        />
      </section>

      <BouncyAccordion
        className="mt-7"
        items={[
          {
            id: "findings",
            title: "Constats et valeurs atypiques",
            description: (
              <div className="space-y-4 text-sm">
                <p>
                  {summary.observed > 0
                    ? `${summary.observed} lignes sur ${summary.total} contribuent à ${measureLabels[config.metric].toLocaleLowerCase("fr")}. ${summary.method === "median" ? "La médiane entre formations" : summary.method === "paired-ratio" ? "Le ratio sur lignes appariées" : "La somme des valeurs publiées"} est de ${formatMeasure(summary.value, config.metric)}.`
                    : "Aucune valeur exploitable pour cet indicateur dans ce périmètre."}
                </p>
                {topFiveShare !== null && (
                  <p>
                    Les {Math.min(5, groups.length)} premiers groupes de{" "}
                    {dimensionLabels[config.dimension].toLocaleLowerCase("fr")}{" "}
                    concentrent {number(topFiveShare)} % du total observé.
                  </p>
                )}
                <p>
                  {stats.outliers.length} valeurs hors des bornes{" "}
                  {formatMeasure(stats.lowerFence, config.metric)} et{" "}
                  {formatMeasure(stats.upperFence, config.metric)}. Ces bornes
                  sont à 1,5 écart interquartile des quartiles ; elles signalent
                  des valeurs éloignées, sans conclure à une erreur.
                </p>
                {stats.outliers.length > 0 && (
                  <Table
                    aria-label="Valeurs atypiques"
                    data={stats.outliers}
                    columns={rowColumns}
                    height={Math.min(300, stats.outliers.length * 44 + 50)}
                    rowHeight={44}
                    getRowId={(row) => row.id}
                  />
                )}
              </div>
            ),
          },
          {
            id: "saved",
            title: "Vues et cohortes enregistrées",
            description: (
              <SavedViews
                href={href}
                defaultName={`${measureLabels[config.metric]} · ${data.source.campaign}`}
              />
            ),
          },
          {
            id: "source",
            title: "Source, définitions et méthode",
            description: (
              <div className="space-y-4 text-xs leading-6 text-muted-foreground">
                <p>
                  <a
                    href={datasetUrl(data.source.datasetId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4"
                  >
                    {data.source.provider} · {data.source.datasetId}
                  </a>
                  <br />
                  Campagne {data.source.campaign} ·{" "}
                  {
                    families.find((family) => family.value === data.family)
                      ?.label
                  }{" "}
                  · {data.source.license}
                  <br />
                  Collecté le{" "}
                  {new Intl.DateTimeFormat("fr-FR", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(data.source.collectedAt))}
                  <br />
                  <span className="break-all">
                    Version {data.source.releaseId}
                  </span>
                </p>
                <p>
                  Une seule campagne et une seule version de source. Les
                  candidatures additionnées ne sont pas des personnes uniques.
                  Les sommes portent uniquement sur les valeurs publiées ; les
                  absences et valeurs masquées ne sont jamais remplacées par
                  zéro. Les pourcentages sont résumés par leur médiane entre
                  formations, jamais par une moyenne ni par un taux national.
                  Les populations d’APB, de Parcoursup et de l’apprentissage
                  restent séparées.
                </p>
                {data.notices.map((notice) => (
                  <p key={notice}>{notice}</p>
                ))}
                <p>
                  Le JSON et le SVG conservent la sélection complète, les
                  définitions, les états et la provenance. Le CSV commence par
                  une ligne « metadata » contenant ces paramètres ; les lignes «
                  record » contiennent les formations. Les liens et vues
                  enregistrées ciblent cette version tant qu’elle est conservée.
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {data.definitions.map((definition) => (
                    <div key={definition.key}>
                      <dt className="font-medium text-foreground">
                        {definition.label} · <code>{definition.field}</code>
                      </dt>
                      <dd>{definition.description}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ),
          },
        ]}
      />
    </PanelMain>
  );
}
function EmptyMetric() {
  return (
    <p className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
      Aucune valeur publiée pour cet indicateur dans ce périmètre.
    </p>
  );
}

function MatrixView({
  cells,
  config,
  onFilter,
}: {
  cells: ReturnType<typeof matrix>;
  config: AnalysisConfig;
  onFilter: (dimension: Dimension, value: string) => void;
}) {
  const columns = [...new Set(cells.map((cell) => cell.column))];
  const labels = [...new Set(cells.map((cell) => cell.row))];
  const [offset, setOffset] = useState(0);
  const safeOffset = Math.min(
    offset,
    Math.max(0, Math.ceil(columns.length / 6) - 1) * 6,
  );
  const visible = columns.slice(safeOffset, safeOffset + 6);
  const byKey = new Map(
    cells.map((cell) => [JSON.stringify([cell.row, cell.column]), cell]),
  );
  const max = Math.max(
    1,
    ...cells.map((cell) =>
      config.mode === "share" ? (cell.share ?? 0) : (cell.value ?? 0),
    ),
  );
  const tableColumns: TableColumn<{ label: string }>[] = [
    {
      key: "label",
      header: dimensionLabels[config.dimension],
      width: "230px",
      cell: (row) => row.label,
    },
    ...visible.map((column) => ({
      key: column,
      header: column,
      width: "170px",
      align: "right" as const,
      cell: (row: { label: string }) => {
        const cell = byKey.get(JSON.stringify([row.label, column]));
        if (!cell)
          return <span className="text-muted-foreground">Aucune ligne</span>;
        const value = config.mode === "share" ? cell.share : cell.value;
        const content = (
          <>
            <span className="block tabular-nums">
              {config.mode === "share"
                ? value === null
                  ? "—"
                  : `${number(value)} %`
                : formatMeasure(value, config.metric)}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {cell.observed} / {cell.total} obs.
            </span>
          </>
        );
        const style = {
          backgroundColor: `color-mix(in oklab, var(--foreground) ${value === null ? 0 : 4 + (value / max) * 18}%, transparent)`,
        };
        const dimension = ["region", "type", "status"].includes(
          config.dimension,
        )
          ? config.dimension
          : ["region", "type", "status"].includes(config.column)
            ? config.column
            : null;
        const label = dimension === config.dimension ? row.label : column;
        return dimension && label !== "Non renseigné" ? (
          <button
            type="button"
            onClick={() => onFilter(dimension, label)}
            title={`Filtrer : ${label}`}
            className="w-full rounded px-2 py-1 text-right hover:outline"
            style={style}
          >
            {content}
          </button>
        ) : (
          <div className="rounded px-2 py-1" style={style}>
            {content}
          </div>
        );
      },
    })),
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {labels.length} lignes × {columns.length} colonnes · Intensité
          proportionnelle à la valeur
        </span>
        {columns.length > 6 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={safeOffset === 0}
              onClick={() => setOffset(safeOffset - 6)}
            >
              Précédentes
            </Button>
            <span>
              {safeOffset + 1}–{Math.min(columns.length, safeOffset + 6)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={safeOffset + 6 >= columns.length}
              onClick={() => setOffset(safeOffset + 6)}
            >
              Suivantes
            </Button>
          </div>
        )}
      </div>
      <Table
        aria-label="Tableau croisé des formations"
        data={labels.map((label) => ({ label }))}
        columns={tableColumns}
        getRowId={(row) => row.label}
        height={Math.min(480, labels.length * 58 + 50)}
        rowHeight={58}
        className="text-xs"
      />
    </div>
  );
}
