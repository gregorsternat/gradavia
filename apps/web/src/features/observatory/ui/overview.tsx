"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Layers3,
  Map,
  Search,
} from "lucide-react";
import { ButtonLink } from "@/components/motion/button/base";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/motion/tabs";
import { AreaChart } from "@/components/charts/tremor/components/AreaChart/AreaChart";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { DonutChart } from "@/components/charts/tremor/components/DonutChart/DonutChart";
import {
  composition,
  compact,
  number,
  orderBreakdown,
  type OverviewResult,
  type OverviewData,
} from "../domain/overview";
import {
  CampaignSelect,
  ChartData,
  CoverageNote,
  DataUnavailable,
  Reveal,
  SourceLine,
  Stat,
} from "./shared";

function History({ data }: { data: OverviewData }) {
  const [metric, setMetric] = useState("capacity");
  const observations = data.history.filter(
    (h) => h.campaign <= data.source.campaign,
  );
  const history = observations.map((row) => ({
    Campagne: String(row.campaign),
    "Places proposées": row.capacity.value,
    Admis: row.admitted.value,
  }));
  const category = metric === "capacity" ? "Places proposées" : "Admis";
  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="panel-heading">
            L’offre de formation au fil des campagnes
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {observations[0]?.campaign} — {data.source.campaign}
          </p>
        </div>
        <RadioGroup
          aria-label="Indicateur historique"
          orientation="horizontal"
          value={metric}
          onValueChange={setMetric}
          className="w-fit gap-0.5 rounded-lg bg-subtle p-1"
        >
          <RadioGroupItem value="capacity" label="Places" variant="segment" />
          <RadioGroupItem value="admitted" label="Admis" variant="segment" />
        </RadioGroup>
      </div>
      <div className="mt-6">
        <AreaChart
          className="orvio-chart h-64 sm:h-72"
          data={history}
          index="Campagne"
          categories={[category]}
          colors={["charcoal"]}
          fill="gradient"
          showLegend={false}
          valueFormatter={compact}
          allowDecimals={false}
          yAxisWidth={46}
          connectNulls={false}
          minValue={0}
        />
      </div>
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Périmètre des formations variable selon les campagnes. Les sommes
        portent sur les valeurs publiées.
      </p>
      <ChartData
        title="Offre de formation par campagne"
        data={observations}
        columns={[
          { key: "campaign", header: "Campagne", cell: (r) => r.campaign },
          {
            key: "capacity",
            header: "Places",
            align: "right",
            cell: (r) =>
              r.capacity.value === null
                ? "Non publié"
                : number(r.capacity.value),
          },
          {
            key: "admitted",
            header: "Admis",
            align: "right",
            cell: (r) =>
              r.admitted.value === null
                ? "Non publié"
                : number(r.admitted.value),
          },
          {
            key: "coverage",
            header: "Lignes renseignées",
            align: "right",
            cell: (r) =>
              `${number((metric === "capacity" ? r.capacity : r.admitted).observed)} / ${number(r.formations)}`,
          },
        ]}
      />
    </section>
  );
}

function Composition({ data }: { data: OverviewData }) {
  const router = useRouter();
  const groups = composition(data.byType, 4);
  const shades = [
    "bg-[var(--chart-primary)]",
    "bg-[var(--chart-secondary)]",
    "bg-neutral-300 dark:bg-neutral-600",
    "bg-neutral-400 dark:bg-neutral-500",
    "bg-neutral-200 dark:bg-neutral-700",
  ];
  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="panel-heading">Les familles de formation</h2>
        <Layers3 className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Répartition des {number(data.totals.formations)} formations
      </p>
      <DonutChart
        className="orvio-chart mx-auto my-6 size-44"
        data={groups}
        category="name"
        value="value"
        colors={["charcoal", "silver", "mist", "steel", "pale"]}
        showLabel
        label={number(data.totals.formations)}
        valueFormatter={number}
        onValueChange={(v) => {
          if (v && !v.group)
            router.push(
              `/formations?campagne=${data.source.campaign}&type=${encodeURIComponent(String(v.name))}`,
            );
        }}
      />
      <ul className="space-y-3">
        {groups.map((row, index) => (
          <li key={row.name} className="flex items-center gap-2.5 text-xs">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-sm ${shades[index]}`}
            />
            {row.group ? (
              <span className="flex-1">{row.name}</span>
            ) : (
              <Link
                href={`/formations?campagne=${data.source.campaign}&type=${encodeURIComponent(row.name)}`}
                className="flex-1 truncate hover:underline"
              >
                {row.name}
              </Link>
            )}
            <span className="font-medium tabular-nums">
              {number(row.value)}
            </span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">
              {data.totals.formations
                ? Math.round((row.value / data.totals.formations) * 100)
                : 0}{" "}
              %
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Distribution({ data }: { data: OverviewData }) {
  const coverage = data.coverage.find((row) => row.key === "accessRate");
  const rows = data.accessDistribution.map((r) => ({
    "Taux d’accès": r.label,
    Formations: r.count,
  }));
  return (
    <section className="panel min-w-0 p-5 sm:p-6">
      <h2 className="panel-heading">Distribution des taux d’accès</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Nombre de formations par tranche de taux d’accès officiel
      </p>
      {coverage?.observed ? (
        <BarChart
          className="orvio-chart mt-6 h-56"
          data={rows}
          index="Taux d’accès"
          categories={["Formations"]}
          colors={["charcoal"]}
          showLegend={false}
          valueFormatter={number}
          allowDecimals={false}
          yAxisWidth={42}
          barCategoryGap="28%"
        />
      ) : (
        <div className="mt-6 flex h-56 items-center justify-center rounded-lg bg-sidebar px-6 text-center text-sm text-muted-foreground">
          Le taux d’accès n’est pas publié pour cette campagne.
        </div>
      )}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        {number(coverage?.observed ?? 0)} taux publiés sur{" "}
        {number(data.totals.formations)} formations. Un indicateur historique,
        pas une probabilité individuelle.
      </p>
      {Boolean(coverage?.observed) && (
        <ChartData
          title="Répartition des taux d’accès"
          data={rows}
          columns={[
            { key: "Taux d’accès", header: "Taux d’accès officiel" },
            {
              key: "Formations",
              header: "Formations",
              align: "right",
              cell: (r) => number(r.Formations),
            },
          ]}
        />
      )}
    </section>
  );
}

export function Overview({ result }: { result: OverviewResult }) {
  if (result.status !== "ready")
    return <DataUnavailable status={result.status} title="Vue d’ensemble" />;
  return <ReadyOverview data={result.data} />;
}
function ReadyOverview({ data }: { data: OverviewData }) {
  const regions = orderBreakdown(data.byRegion, "formations").slice(0, 6);
  return (
    <main id="contenu" tabIndex={-1} className="py-6 sm:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9">
        <div>
          <h1 className="page-title">Vue d’ensemble</h1>
          <p className="page-subtitle">
            Explorez les formations et les admissions Parcoursup.
          </p>
        </div>
        <CampaignSelect
          campaign={data.source.campaign}
          campaigns={data.campaigns}
          path="/observatoire"
        />
      </div>
      {data.requestNotices.map((notice) => (
        <p
          key={notice}
          className="mb-4 text-xs text-muted-foreground"
          role="status"
        >
          {notice}
        </p>
      ))}
      <Reveal className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl bg-sidebar p-5 sm:mb-8 sm:gap-y-8 sm:py-6 lg:grid-cols-4 lg:px-7">
        <Stat
          label="Formations"
          value={data.totals.formations}
          detail={`${number(data.totals.establishments)} établissements identifiés`}
          definition="Nombre de lignes formation/établissement de la campagne. Les doublons de la source sont conservés. Hors apprentissage."
        />
        <Stat
          label="Places proposées"
          value={data.totals.capacity.value}
          detail={
            data.totals.capacity.observed < data.totals.capacity.total ? (
              <CoverageNote total={data.totals.capacity} />
            ) : undefined
          }
          definition="Somme des capacités d’accueil publiées. Les valeurs absentes ou masquées ne sont pas remplacées par zéro."
        />
        <Stat
          label="Candidatures cumulées"
          value={data.totals.applications.value}
          detail="Vœux par formation · Non dédupliqués"
          definition="Somme des candidatures déposées auprès des formations. Une personne peut candidater plusieurs fois : ce total ne compte pas des personnes uniques."
        />
        <Stat
          label="Admis"
          value={data.totals.admitted.value}
          detail={
            data.totals.admitted.observed < data.totals.admitted.total ? (
              <CoverageNote total={data.totals.admitted} />
            ) : undefined
          }
          definition="Somme des candidats ayant accepté une proposition selon le champ publié, phases principale et complémentaire."
        />
      </Reveal>
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(280px,1fr)]">
        <History data={data} />
        <Composition data={data} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Distribution data={data} />
        <section className="panel min-w-0 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="panel-heading">
                Les formations dans les territoires
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Les six régions comptant le plus de formations
              </p>
            </div>
            <Map className="size-4 shrink-0 text-muted-foreground" />
          </div>
          <BarChart
            className="orvio-chart mt-6 h-64"
            data={regions.map((r) => ({
              Région: r.label,
              Formations: r.formations,
            }))}
            index="Région"
            categories={["Formations"]}
            colors={["silver"]}
            layout="vertical"
            showLegend={false}
            valueFormatter={number}
            allowDecimals={false}
            yAxisWidth={148}
          />
          <Link
            href={`/territoires?campagne=${data.source.campaign}`}
            className="mt-4 inline-flex items-center gap-2 text-xs font-medium"
          >
            Explorer tous les territoires <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>
      <Tabs defaultValue="types" variant="underline" className="mt-10">
        <div className="mb-5 flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="types">Explorer par filière</TabsTrigger>
            <TabsTrigger value="regions">Explorer par région</TabsTrigger>
          </TabsList>
          <Search className="size-4 text-muted-foreground" />
        </div>
        <TabsContent value="types">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orderBreakdown(data.byType, "formations").map((r) => (
              <Link
                href={`/formations?campagne=${data.source.campaign}&type=${encodeURIComponent(r.label)}`}
                key={r.label}
                className="group flex items-center justify-between gap-4 rounded-lg bg-sidebar px-4 py-4 transition-colors hover:bg-subtle"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">
                    {r.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {number(r.formations)} formations
                  </span>
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="regions">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orderBreakdown(data.byRegion, "formations").map((r) => (
              <Link
                href={`/formations?campagne=${data.source.campaign}&region=${encodeURIComponent(r.label)}`}
                key={r.label}
                className="flex items-center justify-between gap-4 rounded-lg bg-sidebar px-4 py-4 hover:bg-subtle"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">
                    {r.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {number(r.formations)} formations
                  </span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
        <SourceLine source={data.source} />
        <ButtonLink
          href="/sources#indicateurs"
          variant="ghost"
          size="sm"
          className="rounded-lg"
        >
          <BookOpen className="size-3.5" /> Lire les indicateurs
        </ButtonLink>
      </div>
    </main>
  );
}
