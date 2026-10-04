"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Layers3,
  Info,
  Map,
  Search,
} from "lucide-react";
import { AreaChart } from "@/components/charts/tremor/components/AreaChart/AreaChart";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Loader } from "@/components/motion/loader";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import { Tooltip } from "@/components/motion/tooltip";
import { datasetUrl } from "@/features/formations/domain/explorer";
import {
  compact,
  number,
  orderBreakdown,
  type OverviewData,
  type OverviewResult,
} from "@/features/observatory/domain/overview";
import { ChartData } from "@/features/observatory/ui/shared";

const previewClassName = "min-w-0 rounded-[18px] bg-surface text-left";

function PreviewStat({
  label,
  value,
  definition,
  detail,
}: {
  label: string;
  value: number | null;
  definition: string;
  detail?: ReactNode;
}) {
  return (
    <dl className="min-w-0 py-1">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        <Tooltip content={definition}>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Définition : ${label}`}
          >
            <Info className="size-3" aria-hidden="true" />
          </Button>
        </Tooltip>
      </dt>
      <dd className="mt-2 text-[clamp(1.5rem,2.8vw,2.5rem)] leading-none font-medium tracking-[-.055em] tabular-nums sm:mt-3">
        {value === null ? (
          <span className="text-base">Non publié</span>
        ) : (
          <span>{number(value)}</span>
        )}
        {detail && (
          <span className="mt-2 block text-[11px] leading-5 font-normal tracking-normal text-muted-foreground">
            {detail}
          </span>
        )}
      </dd>
    </dl>
  );
}

export function OverviewPreview({ result }: { result: OverviewResult }) {
  if (result.status !== "ready") return <PreviewFallback />;
  return <ReadyPreview data={result.data} />;
}

export function PreviewLoading() {
  return (
    <section
      aria-label="Aperçu de l’observatoire"
      className={`${previewClassName} flex min-h-[780px] flex-col px-5 py-6 sm:min-h-[600px] sm:px-7 lg:min-h-[480px]`}
    >
      <div aria-hidden="true" inert className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-32 rounded bg-subtle" />
          <div className="h-7 w-24 rounded-md bg-sidebar" />
        </div>
        <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-6 min-[480px]:grid-cols-3 sm:gap-x-8">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0">
              <div className="h-3 w-20 max-w-full rounded bg-subtle" />
              <div className="mt-3 h-8 w-28 max-w-full rounded-md bg-sidebar" />
            </div>
          ))}
        </div>
        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_210px] lg:gap-8">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="h-3 w-28 rounded bg-subtle" />
              <div className="h-8 w-32 rounded-lg bg-sidebar" />
            </div>
            <div className="mt-3 h-44 rounded-xl bg-sidebar" />
            <div className="mt-4 h-2.5 w-64 max-w-full rounded bg-subtle" />
          </div>
          <div className="rounded-xl bg-sidebar p-4">
            <div className="h-3 w-16 rounded bg-subtle" />
            <div className="mt-5 grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
              {[0, 1, 2].map((index) => (
                <div key={index} className="min-w-0">
                  <div className="h-3 w-24 max-w-full rounded bg-subtle" />
                  <div className="mt-2 h-2.5 w-16 rounded bg-subtle" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2.5 text-xs text-muted-foreground">
        <Loader
          size={14}
          label="Chargement de l’aperçu…"
          className="text-muted-foreground"
        />
        <span aria-hidden="true">Chargement de l’aperçu…</span>
      </div>
    </section>
  );
}

function ReadyPreview({ data }: { data: OverviewData }) {
  const [metric, setMetric] = useState<"capacity" | "admitted">("capacity");
  const observations = data.history
    .filter((row) => row.campaign <= data.source.campaign)
    .sort((a, b) => a.campaign - b.campaign);
  const hasHistory =
    observations.filter((row) => row[metric].value !== null).length >= 2;
  const category = metric === "capacity" ? "Places proposées" : "Admis";
  const types = orderBreakdown(data.byType, "formations")
    .filter((row) => row.label !== "Non renseigné")
    .slice(0, 3);
  const regions = orderBreakdown(data.byRegion, metric).slice(0, 3);
  const largestRegionalValue = Math.max(
    ...regions.map((row) => row[metric].value ?? 0),
    0,
  );
  const selectedTotal = data.totals[metric];
  const observationHasPartialCoverage = observations.some(
    (row) => row[metric].observed < row[metric].total,
  );

  return (
    <section aria-label="Aperçu de l’observatoire" className={previewClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex items-center gap-2.5">
          <ChartNoAxesCombined
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 className="text-sm font-semibold tracking-tight">
            L’observatoire
          </h2>
        </div>
        <span className="rounded-md bg-subtle px-2.5 py-1.5 text-[11px] tabular-nums">
          Campagne {data.source.campaign}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 pb-6 pt-5 min-[480px]:grid-cols-3 sm:gap-x-8 sm:px-7">
        <PreviewStat
          label="Formations"
          value={data.totals.formations}
          definition="Nombre de lignes formation/établissement de cette campagne Parcoursup, hors apprentissage. Les doublons de la source sont conservés."
          detail={
            <span className="min-[480px]:hidden">
              {number(data.totals.establishments)} établissements identifiés
            </span>
          }
        />
        <PreviewStat
          label="Places"
          value={data.totals.capacity.value}
          definition="Somme des capacités d’accueil publiées pour cette campagne. Les places non renseignées ou masquées ne sont pas remplacées par zéro."
          detail={
            data.totals.capacity.observed < data.totals.capacity.total
              ? `Renseigné pour ${number(data.totals.capacity.observed)} / ${number(data.totals.capacity.total)} lignes`
              : undefined
          }
        />
        <div className="hidden min-[480px]:block">
          <PreviewStat
            label="Établissements"
            value={data.totals.establishments}
            definition="Nombre de codes UAI distincts renseignés dans la source de cette campagne. Les établissements sans code ne sont pas déduits de leur nom."
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-6 px-5 sm:px-7 lg:grid-cols-[minmax(0,1fr)_210px] lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-medium">
              {hasHistory
                ? "Au fil des campagnes"
                : metric === "capacity"
                  ? "Places par région"
                  : "Admis par région"}
            </h3>
            <RadioGroup
              aria-label="Indicateur de l’aperçu"
              orientation="horizontal"
              value={metric}
              onValueChange={(value) =>
                setMetric(value === "admitted" ? "admitted" : "capacity")
              }
              className="w-fit gap-0.5 rounded-lg bg-subtle p-0.5"
            >
              <RadioGroupItem
                value="capacity"
                label="Places"
                variant="segment"
              />
              <RadioGroupItem
                value="admitted"
                label="Admis"
                variant="segment"
              />
            </RadioGroup>
          </div>

          {hasHistory ? (
            <>
              <AreaChart
                role="group"
                aria-label={`${category} par campagne`}
                className="orvio-chart mt-3 h-36 sm:h-40"
                data={observations.map((row) => ({
                  Campagne: String(row.campaign),
                  [category]: row[metric].value,
                }))}
                index="Campagne"
                categories={[category]}
                colors={["charcoal"]}
                fill="gradient"
                showLegend={false}
                valueFormatter={compact}
                allowDecimals={false}
                yAxisWidth={42}
                minValue={0}
                connectNulls={false}
              />
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {category} · Périmètre variable selon les campagnes.
                {observationHasPartialCoverage &&
                  " Certaines sommes sont partielles."}{" "}
                Couverture détaillée dans les valeurs.
              </p>
              <ChartData
                title={`${category} par campagne et couverture`}
                data={observations}
                columns={[
                  {
                    key: "campaign",
                    header: "Campagne",
                    width: "100px",
                    cell: (row) => row.campaign,
                  },
                  {
                    key: "value",
                    header: category,
                    width: "150px",
                    align: "right",
                    cell: (row) =>
                      row[metric].value === null
                        ? "Non publié"
                        : number(row[metric].value),
                  },
                  {
                    key: "coverage",
                    header: "Lignes renseignées",
                    width: "170px",
                    align: "right",
                    cell: (row) =>
                      `${number(row[metric].observed)} / ${number(row[metric].total)}`,
                  },
                  {
                    key: "source",
                    header: "Source",
                    width: "120px",
                    cell: (row) => (
                      <a
                        href={datasetUrl(row.source.datasetId)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:decoration-foreground"
                        aria-label={`Source Parcoursup ${row.campaign}`}
                      >
                        Parcoursup
                        <ArrowUpRight aria-hidden="true" className="size-3" />
                      </a>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <>
              <ul
                className="mt-6 space-y-5"
                aria-label={`${category} par région`}
              >
                {regions.map((row) => (
                  <li key={row.label}>
                    <div className="flex items-baseline justify-between gap-4 text-xs">
                      <span className="min-w-0 break-words">{row.label}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {row[metric].value === null
                          ? "Non publié"
                          : number(row[metric].value)}
                      </span>
                    </div>
                    {row[metric].value !== null && (
                      <div
                        aria-hidden="true"
                        className="mt-2 h-1 rounded-full bg-subtle"
                      >
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{
                            width: `${largestRegionalValue ? (row[metric].value / largestRegionalValue) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    )}
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {number(row[metric].observed)} /{" "}
                      {number(row[metric].total)} lignes renseignées
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
                {category} · Somme des valeurs publiées.
                {selectedTotal.observed < selectedTotal.total &&
                  " Couverture partielle."}
              </p>
            </>
          )}
        </div>

        <div className="min-w-0 rounded-xl bg-sidebar px-4 py-4 lg:self-start">
          <h3 className="text-xs font-medium">Les filières</h3>
          <ul className="mt-3 grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {types.map((row) => (
              <li key={row.label} className="min-w-0">
                <Link
                  href={`/formations?campagne=${data.source.campaign}&type=${encodeURIComponent(row.label)}`}
                  className="group -mx-2 flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-subtle sm:min-h-16"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-xs font-medium leading-relaxed">
                      {row.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
                      {number(row.formations)} formations
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-b-[18px] bg-sidebar/70 px-5 py-4 sm:px-7">
        <p className="min-w-0 text-[10px] leading-relaxed text-muted-foreground">
          <a
            href={datasetUrl(data.source.datasetId)}
            target="_blank"
            rel="noreferrer"
            title={data.source.provider}
            aria-label={`Source Parcoursup : ${data.source.provider}`}
            className="underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Source : Parcoursup
          </a>
          <span className="block">Hors apprentissage</span>
        </p>
        <Link
          href={`/observatoire?campagne=${data.source.campaign}`}
          className="inline-flex min-h-8 items-center gap-2 text-xs font-medium"
        >
          Ouvrir l’observatoire
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}

export function PreviewFallback() {
  const destinations = [
    {
      href: "/observatoire",
      label: "Vue d’ensemble",
      icon: ChartNoAxesCombined,
    },
    { href: "/territoires", label: "Territoires", icon: Map },
    { href: "/specialites", label: "Spécialités", icon: Layers3 },
  ];

  return (
    <section aria-label="Explorer Parcoursup" className={previewClassName}>
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex size-11 items-center justify-center rounded-xl bg-subtle">
          <BookOpen aria-hidden="true" className="size-5" strokeWidth={1.6} />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-[-0.045em] sm:text-[28px]">
          Explorer Parcoursup
        </h2>
        <form
          action="/formations"
          method="get"
          role="search"
          aria-label="Explorer Parcoursup"
          className="mt-6"
        >
          <div className="flex items-end gap-2">
            <Input
              type="search"
              name="q"
              label="Une formation, un établissement, une ville"
              placeholder="Rechercher une formation"
              className="min-w-0 flex-1"
              classNames={{
                label: "mb-1 px-0 text-xs font-normal text-muted-foreground",
                field: "h-12 rounded-xl bg-background",
                input: "text-sm",
              }}
              leftIcon={<Search aria-hidden="true" />}
              autoComplete="off"
              maxLength={120}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Rechercher les formations"
              className="size-12 shrink-0 rounded-xl"
            >
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {["Informatique", "Droit", "Santé"].map((query) => (
            <Link
              href={`/formations?q=${encodeURIComponent(query)}`}
              key={query}
              className="inline-flex min-h-8 items-center rounded-md bg-subtle px-2.5 text-[11px] transition-colors hover:bg-foreground/10"
            >
              {query}
            </Link>
          ))}
        </div>
        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          {destinations.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-w-0 items-center gap-3 rounded-xl bg-sidebar px-3 py-4 transition-colors hover:bg-subtle sm:flex-col sm:items-start sm:gap-5 sm:p-4"
            >
              <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="flex w-full items-center justify-between gap-2 text-xs font-medium">
                {label}
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-[11px] text-muted-foreground">
          Retrouvez les indicateurs dans l’observatoire.
        </p>
      </div>
    </section>
  );
}
