"use client";
import { PanelMain } from "@/features/workspace/ui/navigation";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/features/workspace/ui/navigation";
import Link from "@/features/workspace/ui/navigation";
import { ArrowRight, Bookmark, GitCompareArrows, Plus, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Table, type TableColumn } from "@/components/motion/table";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import type {
  DetailResult,
  FormationDetail,
  MetricKey,
} from "../domain/api-contract";
import { selectionUrl } from "../domain/selection";
import {
  formatCount,
  formationUrl,
  metricLabels,
  observedMetric,
  percentMetrics,
} from "../domain/metrics";
import { useFormationSelection } from "./selection-provider";
import { comparisonComments } from "../domain/selection-workspace";
import {
  ExportButton,
  FormationActions,
  MetricValue,
  Reveal,
  SelectField,
  ShareButton,
  SourceDisclosure,
} from "./shared";

type LoadedSelection = { id: string; result: DetailResult }[];
function readyDetails(results: LoadedSelection): FormationDetail[] {
  return results.flatMap(({ result }) =>
    result.status === "ready" ? [result.data] : [],
  );
}
function EmptySelection({ type }: { type: "comparison" | "favorites" }) {
  const favorites = type === "favorites";
  const Icon = favorites ? Bookmark : GitCompareArrows;
  return (
    <section className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-subtle">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium">
        {favorites
          ? "Votre prochaine formation se trouve peut-être ici."
          : "Quelles formations vous intéressent ?"}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {favorites
          ? "Enregistrez les formations à retrouver plus tard avec le marque-page."
          : "Sélectionnez jusqu’à 4 formations d’une même campagne pour comparer leurs indicateurs."}
      </p>
      <ButtonLink href="/formations" className="mt-6 rounded-lg">
        Explorer les formations
        <ArrowRight className="size-4" />
      </ButtonLink>
    </section>
  );
}

export function ComparisonPageView({
  results: loadedResults,
  ids,
  explicit,
}: {
  results: LoadedSelection;
  ids: string[];
  explicit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selection = useFormationSelection();
  const [metric, setMetric] = useState<MetricKey>("accessRate");
  const localIds = selection.comparison.join(",");
  useEffect(() => {
    if (!explicit && localIds)
      router.replace(selectionUrl(localIds.split(",")));
  }, [explicit, localIds, router]);
  // A retained payload may still contain formations removed from the current URL.
  const results = loadedResults.filter(({ id }) => ids.includes(id));
  const details = readyDetails(results);
  const campaigns = new Set(details.map((detail) => detail.source.campaign));
  const compatible = campaigns.size <= 1;
  const remove = (id: string) => {
    if (pending) return;
    selection.removeComparison(id);
    const next = ids.filter((value) => value !== id);
    startTransition(() =>
      router.push(next.length ? selectionUrl(next) : "/comparer?ids="),
    );
  };
  const rows = (Object.keys(metricLabels) as MetricKey[]).map((key) => ({
    key,
    label: metricLabels[key],
  }));
  const columns: TableColumn<(typeof rows)[number]>[] = [
    {
      key: "label",
      header: "Indicateur",
      width: "240px",
      cell: (row) => (
        <span className="block text-xs leading-4 whitespace-normal text-muted-foreground">
          {row.label}
        </span>
      ),
    },
    ...details.map((detail) => ({
      key: detail.formation.id,
      header: (
        <span className="text-xs">
          Formation {ids.indexOf(detail.formation.id) + 1}
        </span>
      ),
      align: "right" as const,
      cell: (row: (typeof rows)[number]) => (
        <MetricValue
          metric={detail.formation.metrics[row.key]}
          metricKey={row.key}
          className="text-xs font-medium"
        />
      ),
    })),
  ];
  const chartData = details.map((detail) => ({
    formation: `Formation ${ids.indexOf(detail.formation.id) + 1}`,
    [metricLabels[metric]]: observedMetric(detail.formation.metrics, metric),
  }));
  return (
    <PanelMain id="contenu" className="min-w-0 flex-1 py-8" aria-busy={pending}>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Votre sélection</p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">
            Comparer les formations
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Les mêmes indicateurs, côte à côte.
          </p>
        </div>
        {details.length > 0 && (
          <div className="flex gap-2">
            <ShareButton />
            <ExportButton
              rows={details}
              label="Exporter la comparaison"
              filename="gradavia-comparaison"
            />
          </div>
        )}
      </div>
      {!ids.length ? (
        <EmptySelection type="comparison" />
      ) : (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {results.map(({ id, result }, index) =>
              result.status === "ready" ? (
                <Reveal
                  key={id}
                  className="flex h-full flex-col rounded-xl border border-border bg-surface p-3 md:p-4"
                >
                  <div className="mb-2 flex items-center justify-between md:mb-4">
                    <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[10px] font-semibold text-background">
                      {index + 1}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Retirer ${result.data.formation.title} de la comparaison`}
                      onClick={() => remove(id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                  <Link
                    href={formationUrl(id)}
                    className="text-sm leading-5 font-medium hover:underline"
                  >
                    {result.data.formation.title}
                  </Link>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground md:mt-2 md:leading-5">
                    {result.data.formation.establishment}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 md:contents">
                    <p className="min-w-0 text-[11px] text-muted-foreground md:mt-1">
                      {result.data.formation.city ?? "Ville non renseignée"} ·{" "}
                      {result.data.source.campaign}
                    </p>
                    <div className="shrink-0 md:mt-auto md:pt-4">
                      <FormationActions
                        formation={result.data.formation}
                        campaign={result.data.source.campaign}
                        comparisonSelected
                        disabled={pending}
                        onComparisonToggle={() => remove(id)}
                      />
                    </div>
                  </div>
                </Reveal>
              ) : (
                <div key={id} className="rounded-xl border border-border p-4">
                  <p className="text-sm">
                    {result.status === "not-found"
                      ? "Cette formation n’est plus disponible."
                      : "Chargement impossible."}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => remove(id)}
                    className="mt-3"
                  >
                    Retirer
                    <X className="size-3" />
                  </Button>
                </div>
              ),
            )}
            {ids.length < 4 && compatible && details.length === ids.length && (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (pending) return;
                  const adopted = selection.adoptComparison(
                    details.map(({ formation, source }) => ({
                      id: formation.id,
                      title: formation.title,
                      establishment: formation.establishment,
                      campaign: source.campaign,
                    })),
                  );
                  if (adopted)
                    startTransition(() =>
                      router.push(
                        `/formations?campagne=${details[0]!.source.campaign}`,
                      ),
                    );
                }}
                className="flex h-auto min-h-14 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground md:min-h-40 md:flex-col md:gap-3"
              >
                <Plus className="size-5" />
                Ajouter une formation
              </Button>
            )}
          </div>
          {!compatible ? (
            <section
              role="status"
              className="rounded-xl border border-border bg-subtle p-6"
            >
              <h2 className="text-sm font-semibold">
                Ces formations appartiennent à des campagnes différentes.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Retirez les campagnes différentes pour comparer des données du
                même millésime.
              </p>
            </section>
          ) : details.length > 0 ? (
            <Reveal className="space-y-5">
              {comparisonComments(details, ids).length > 0 && (
                <section
                  aria-label="Différences entre les formations"
                  className="rounded-xl bg-subtle p-5"
                >
                  <h2 className="text-sm font-semibold">
                    Ce qui distingue ces formations
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-6">
                    {comparisonComments(details, ids).map((comment) => (
                      <li key={comment}>{comment}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Les taux d’accès décrivent la campagne passée ; ils ne
                    prédisent pas une admission individuelle.
                  </p>
                </section>
              )}
              <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {metricLabels[metric]}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Campagne {details[0]?.source.campaign} ·{" "}
                      {percentMetrics.has(metric)
                        ? "Pourcentage"
                        : "Effectif publié"}
                    </p>
                  </div>
                  <SelectField
                    label="Indicateur de comparaison"
                    value={metric}
                    onChange={(key) => setMetric(key as MetricKey)}
                    options={Object.entries(metricLabels).map(
                      ([value, label]) => ({ value, label }),
                    )}
                    className="w-52"
                  />
                </div>
                {chartData.some((row) => row[metricLabels[metric]] !== null) ? (
                  <BarChart
                    data={chartData}
                    index="formation"
                    categories={[metricLabels[metric]]}
                    colors={["charcoal"]}
                    showLegend={false}
                    className="gradavia-chart mt-7 h-64"
                    minValue={0}
                    maxValue={percentMetrics.has(metric) ? 100 : undefined}
                    allowDecimals={percentMetrics.has(metric)}
                    valueFormatter={(value) =>
                      percentMetrics.has(metric)
                        ? `${value} %`
                        : formatCount(value)
                    }
                  />
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    Cet indicateur n’est publié pour aucune formation de la
                    sélection.
                  </p>
                )}
              </section>
              <Table
                aria-label="Comparaison des indicateurs"
                data={rows}
                columns={columns}
                getRowId={(row) => row.key}
                rowHeight={52}
                height={570}
                className="rounded-xl bg-surface [&_table]:min-w-[540px]"
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                Le taux d’accès est l’indicateur officiel de la source, pas une
                probabilité personnelle d’admission. Les profils, périmètres et
                types de formation peuvent différer. — : non publié ; masqué :
                valeur masquée par la source.
              </p>
              <div className="flex flex-wrap gap-5">
                {[
                  ...new Map(
                    details.map((detail) => [
                      detail.source.releaseId,
                      detail.source,
                    ]),
                  ).values(),
                ].map((source) => (
                  <SourceDisclosure
                    key={source.releaseId}
                    source={source}
                    compact
                  />
                ))}
              </div>
            </Reveal>
          ) : null}
        </>
      )}
    </PanelMain>
  );
}

export { FavoritesWorkspace as FavoritesPageView } from "./selection-workspace";
