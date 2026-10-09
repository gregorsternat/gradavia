"use client";
import { PanelMain } from "@/features/workspace/ui/navigation";
import { useState } from "react";
import Link from "@/features/workspace/ui/navigation";
import { ArrowUpRight } from "lucide-react";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import { Table } from "@/components/motion/table";
import { Input } from "@/components/motion/input";
import {
  breakdownCsv,
  compact,
  number,
  metricValue,
  orderBreakdown,
  type BreakdownMetric,
  type OverviewResult,
  type OverviewData,
} from "../domain/overview";
import {
  CampaignSelect,
  DataUnavailable,
  DownloadButton,
  SourceLine,
} from "./shared";

const metrics = {
  formations: "Formations",
  capacity: "Places",
  applications: "Candidatures",
  admitted: "Admis",
} as const;
export function Territories({ result }: { result: OverviewResult }) {
  if (result.status !== "ready")
    return <DataUnavailable title="Territoires" status={result.status} />;
  return <ReadyTerritories data={result.data} />;
}
function ReadyTerritories({ data }: { data: OverviewData }) {
  const [metric, setMetric] = useState<BreakdownMetric>("formations");
  const [search, setSearch] = useState("");
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr");
  const rows = orderBreakdown(data.byRegion, metric).filter((r) =>
    fold(r.label).includes(fold(search)),
  );
  const chart = rows.map((r) => ({
    Région: r.label,
    [metrics[metric]]: metricValue(r, metric),
  }));
  return (
    <PanelMain id="contenu" tabIndex={-1} className="py-6 sm:py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="page-title">Territoires</h1>
          <p className="page-subtitle">
            Comparez l’offre de formation d’une région à l’autre.
          </p>
        </div>
        <CampaignSelect
          campaign={data.source.campaign}
          campaigns={data.campaigns}
          path="/territoires"
        />
      </div>
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <RadioGroup
            aria-label="Indicateur territorial"
            orientation="horizontal"
            value={metric}
            onValueChange={(v) => setMetric(v as BreakdownMetric)}
            className="grid w-full grid-cols-2 gap-0.5 rounded-lg bg-subtle p-1 sm:flex sm:w-fit"
          >
            {Object.entries(metrics).map(([key, label]) => (
              <RadioGroupItem
                key={key}
                value={key}
                label={label}
                variant="segment"
              />
            ))}
          </RadioGroup>
          <DownloadButton
            content={() =>
              breakdownCsv(rows, data.source.campaign, data.source)
            }
            filename={`gradavia-territoires-${data.source.campaign}.csv`}
          />
        </div>
        <div className="mt-5 max-w-xs">
          <Input
            aria-label="Rechercher une région"
            placeholder="Rechercher une région…"
            value={search}
            onChange={setSearch}
            className="rounded-lg"
          />
        </div>
        {rows.length ? (
          <BarChart
            className="gradavia-chart mt-6"
            style={{ height: Math.max(260, rows.length * 35) }}
            data={chart}
            index="Région"
            categories={[metrics[metric]]}
            colors={["charcoal"]}
            layout="vertical"
            showLegend={false}
            valueFormatter={compact}
            yAxisWidth={170}
            allowDecimals={false}
          />
        ) : (
          <p
            role="status"
            className="py-14 text-center text-sm text-muted-foreground"
          >
            Aucune région ne correspond à cette recherche.
          </p>
        )}
        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          {metric === "applications"
            ? "Les candidatures sont cumulées par formation et ne comptent pas des personnes uniques."
            : metric === "formations"
              ? "Nombre de lignes formation/établissement publiées, hors apprentissage."
              : "Somme des valeurs publiées. Les absences sont conservées et la couverture est détaillée ci-dessous."}
        </p>
      </section>
      <section className="mt-8">
        <h2 className="panel-heading mb-4">Les chiffres par région</h2>
        <Table
          aria-label="Indicateurs par région"
          data={rows}
          getRowId={(r) => r.label}
          height={Math.min(650, rows.length * 48 + 48)}
          rowHeight={48}
          columns={[
            {
              key: "label",
              header: "Région",
              width: "260px",
              sortable: true,
              cell: (r) => (
                <Link
                  href={`/formations?campagne=${data.source.campaign}&region=${encodeURIComponent(r.label)}`}
                  className="inline-flex items-center gap-2 font-medium hover:underline"
                >
                  {r.label}
                  <ArrowUpRight className="size-3 shrink-0" />
                </Link>
              ),
            },
            {
              key: "formations",
              header: "Formations",
              width: "120px",
              align: "right",
              sortable: true,
              cell: (r) => number(r.formations),
            },
            {
              key: "capacity",
              header: "Places",
              width: "140px",
              align: "right",
              sortable: true,
              sortValue: (r) => r.capacity.value ?? -1,
              cell: (r) =>
                r.capacity.value === null
                  ? "Non publié"
                  : number(r.capacity.value),
            },
            {
              key: "applications",
              header: "Candidatures",
              width: "150px",
              align: "right",
              sortable: true,
              sortValue: (r) => r.applications.value ?? -1,
              cell: (r) =>
                r.applications.value === null
                  ? "Non publié"
                  : number(r.applications.value),
            },
            {
              key: "admitted",
              header: "Admis",
              width: "140px",
              align: "right",
              sortable: true,
              sortValue: (r) => r.admitted.value ?? -1,
              cell: (r) =>
                r.admitted.value === null
                  ? "Non publié"
                  : number(r.admitted.value),
            },
            {
              key: "coverage",
              header: `Couverture (${metrics[metric].toLowerCase()})`,
              width: "185px",
              align: "right",
              cell: (r) =>
                metric === "formations"
                  ? `${number(r.formations)} lignes`
                  : `${number(r[metric].observed)} / ${number(r.formations)} lignes`,
            },
          ]}
        />
      </section>
      <div className="mt-8">
        <SourceLine source={data.source} />
      </div>
    </PanelMain>
  );
}
