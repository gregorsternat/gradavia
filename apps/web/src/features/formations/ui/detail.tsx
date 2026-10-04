"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, Info, MapPin } from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/motion/tabs";
import { Table, type TableColumn } from "@/components/motion/table";
import { Tooltip } from "@/components/motion/tooltip";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { LineChart } from "@/components/charts/tremor/components/LineChart/LineChart";
import type { FormationDetail, MetricKey } from "../domain/api-contract";
import {
  formatCount,
  formatMetric,
  formationUrl,
  metricLabels,
  observedMetric,
  percentMetrics,
} from "../domain/metrics";
import {
  ComparisonTray,
  ExportButton,
  FormationActions,
  MetricValue,
  Reveal,
  SelectField,
  ShareButton,
  SourceDisclosure,
} from "./shared";

const volumeKeys = ["capacity", "applications", "offers", "admitted"] as const;
const continuityLabels: Record<
  FormationDetail["history"][number]["continuity"],
  string
> = {
  "same-source-identity": "Identité et libellé concordants",
  "changed-description": "Libellé ou localisation modifié",
  ambiguous: "Plusieurs correspondances",
  missing: "Aucune correspondance",
};

function History({ detail }: { detail: FormationDetail }) {
  const [metric, setMetric] = useState<MetricKey>("applications");
  const history = [...detail.history].sort((a, b) => a.campaign - b.campaign);
  const points = history.map((row) => ({
    campagne: String(row.campaign),
    [metricLabels[metric]]:
      row.continuity === "same-source-identity"
        ? observedMetric(row.metrics, metric)
        : null,
  }));
  const available = points.filter(
    (point) => point[metricLabels[metric]] !== null,
  ).length;
  const columns: TableColumn<FormationDetail["history"][number]>[] = [
    {
      key: "campaign",
      header: "Campagne",
      width: "100px",
      cell: (row) =>
        row.formationId ? (
          <Link
            href={formationUrl(row.formationId)}
            className="text-xs font-medium underline underline-offset-4"
          >
            {row.campaign}
          </Link>
        ) : (
          <span className="text-xs">{row.campaign}</span>
        ),
    },
    {
      key: "continuity",
      header: "Correspondance",
      width: "38%",
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground">
          {continuityLabels[row.continuity]}
        </span>
      ),
    },
    ...(["capacity", "applications", "admitted", "accessRate"] as const).map(
      (key) => ({
        key,
        header: metricLabels[key],
        align: "right" as const,
        cell: (row: FormationDetail["history"][number]) =>
          row.metrics ? (
            <MetricValue
              metric={row.metrics[key]}
              metricKey={key}
              className="text-xs"
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
    ),
  ];
  return (
    <Reveal className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Évolution par campagne</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Même identifiant source et même établissement.
            </p>
          </div>
          <SelectField
            label="Indicateur historique"
            value={metric}
            onChange={(key) => setMetric(key as MetricKey)}
            options={([...volumeKeys, "accessRate"] as MetricKey[]).map(
              (key) => ({ value: key, label: metricLabels[key] }),
            )}
            className="w-44"
          />
        </div>
        {available ? (
          <LineChart
            className="orvio-chart mt-7 h-72"
            data={points}
            index="campagne"
            categories={[metricLabels[metric]]}
            colors={["charcoal"]}
            showLegend={false}
            connectNulls={false}
            valueFormatter={(value) =>
              percentMetrics.has(metric) ? `${value} %` : formatCount(value)
            }
            maxValue={percentMetrics.has(metric) ? 100 : undefined}
            minValue={0}
            allowDecimals={percentMetrics.has(metric)}
          />
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Aucun point comparable publié pour cet indicateur.
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Les changements de libellé ou de localisation interrompent la courbe.
          Un identifiant commun ne garantit pas un périmètre identique ; les
          valeurs de chaque campagne restent consultables ci-dessous.
        </p>
      </section>
      <Table
        aria-label="Historique des indicateurs et continuité"
        data={history}
        columns={columns}
        getRowId={(row) => String(row.campaign)}
        rowHeight={52}
        height={Math.min(500, history.length * 52 + 48)}
        className="rounded-xl bg-surface [&_table]:min-w-[700px]"
      />
      <div className="space-y-3">
        {history
          .filter((row) => row.formationId)
          .map((row) => (
            <SourceDisclosure key={row.campaign} source={row.source} compact />
          ))}
      </div>
    </Reveal>
  );
}

export function FormationDetailView({ detail }: { detail: FormationDetail }) {
  const { formation, source } = detail;
  const [tab, setTab] = useState("synthese");
  const volumeData = volumeKeys.map((key) => ({
    indicateur: key === "capacity" ? "Places" : metricLabels[key],
    Effectif: observedMetric(formation.metrics, key),
  }));
  const bacData = (
    ["generalBacShare", "technologyBacShare", "vocationalBacShare"] as const
  ).map((key) => ({
    profil: metricLabels[key].split(" · ")[0],
    "Part des néo-bacheliers admis": observedMetric(formation.metrics, key),
  }));
  const numerical = volumeData.some((row) => row.Effectif !== null);
  return (
    <main id="contenu" className="min-w-0 flex-1 py-8">
      <Link
        href={`/formations?campagne=${source.campaign}`}
        className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Toutes les formations
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-subtle px-2 py-1 text-[10px] font-medium">
              {formation.type ?? "Type non renseigné"}
            </span>
            <span className="rounded-md bg-subtle px-2 py-1 text-[10px] text-muted-foreground">
              Campagne {source.campaign}
            </span>
            {formation.selectivity && (
              <span className="rounded-md bg-subtle px-2 py-1 text-[10px] text-muted-foreground">
                {formation.selectivity}
              </span>
            )}
          </div>
          <h1 className="text-3xl leading-tight font-semibold tracking-[-0.045em] text-balance lg:text-4xl">
            {formation.title}
          </h1>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <Building2 className="mt-0.5 size-4 shrink-0" />
            {formation.establishment ?? "Établissement non renseigné"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {[
              formation.city ?? "Ville non renseignée",
              formation.department,
              formation.region,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton />
          <FormationActions
            formation={formation}
            campaign={source.campaign}
            labels
          />
        </div>
      </div>
      <Reveal className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {(
          [
            ["capacity", "Places proposées", "Capacité d’accueil"],
            ["applications", "Candidatures", "Vœux enregistrés"],
            ["admitted", "Admis", "Admissions enregistrées"],
            ["accessRate", "Taux d’accès", "Indicateur officiel Parcoursup"],
          ] as const
        ).map(([key, label, note]) => (
          <section
            key={key}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs text-muted-foreground">{label}</h2>
              {key === "accessRate" && (
                <Tooltip content="Taux officiel publié par le MESR pour la phase principale. Il ne représente pas votre probabilité individuelle d’admission.">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="-my-2 size-6"
                    aria-label="Comprendre le taux d’accès"
                  >
                    <Info className="size-3.5" />
                  </Button>
                </Tooltip>
              )}
            </div>
            <div className="mt-3">
              <MetricValue
                metric={formation.metrics[key]}
                metricKey={key}
                animated={!percentMetrics.has(key)}
                className="text-3xl font-semibold tracking-[-0.06em]"
              />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {formation.metrics[key].state === "observed"
                ? note
                : formatMetric(formation.metrics[key], key)}
            </p>
          </section>
        ))}
      </Reveal>
      <Tabs value={tab} onValueChange={setTab} variant="underline">
        <TabsList className="mb-6">
          <TabsTrigger value="synthese">Vue d’ensemble</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="source">Définitions et source</TabsTrigger>
        </TabsList>
        <TabsContent value="synthese" keepMounted={false}>
          <Reveal className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
            <div className="space-y-5">
              <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      Candidatures et admissions
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Effectifs publiés · {source.campaign}
                    </p>
                  </div>
                  <ExportButton
                    rows={[{ formation, source }]}
                    label="CSV"
                    filename={`orvio-formation-${source.campaign}`}
                  />
                </div>
                {numerical ? (
                  <BarChart
                    data={volumeData}
                    index="indicateur"
                    categories={["Effectif"]}
                    className="orvio-chart mt-8 h-64"
                    colors={["charcoal"]}
                    showLegend={false}
                    valueFormatter={formatCount}
                    allowDecimals={false}
                    yAxisWidth={48}
                  />
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    Les effectifs ne sont pas publiés pour cette formation.
                  </p>
                )}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {volumeKeys.map((key) => (
                    <div key={key}>
                      <p className="text-[10px] text-muted-foreground">
                        {metricLabels[key].split(" · ")[0]}
                      </p>
                      <p className="mt-1 text-xs tabular-nums">
                        {formatMetric(formation.metrics[key], key)}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-[11px] leading-5 text-muted-foreground">
                  Ces volumes ne constituent pas un entonnoir de personnes
                  uniques. Le taux d’accès officiel ne se calcule pas en
                  divisant les admis par les candidatures.
                </p>
              </section>
              <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
                <h2 className="text-sm font-semibold">
                  Baccalauréat des néo-bacheliers admis
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Parts publiées parmi les néo-bacheliers admis, en pourcentage
                </p>
                {bacData.some(
                  (row) => row["Part des néo-bacheliers admis"] !== null,
                ) ? (
                  <BarChart
                    data={bacData}
                    index="profil"
                    categories={["Part des néo-bacheliers admis"]}
                    className="orvio-chart mt-7 h-48"
                    colors={["silver"]}
                    showLegend={false}
                    layout="vertical"
                    maxValue={100}
                    minValue={0}
                    yAxisWidth={124}
                    valueFormatter={(value) => `${value} %`}
                  />
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    La répartition n’est pas publiée.
                  </p>
                )}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {(
                    [
                      "generalBacShare",
                      "technologyBacShare",
                      "vocationalBacShare",
                    ] as const
                  ).map((key) => (
                    <div key={key}>
                      <p className="text-[10px] text-muted-foreground">
                        {metricLabels[key].split(" · ")[0]}
                      </p>
                      <p className="mt-1 text-xs">
                        {formatMetric(formation.metrics[key], key)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <aside className="space-y-5">
              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold">Profil des admis</h2>
                <div className="mt-6 space-y-6">
                  {(["femaleShare", "scholarshipShare"] as const).map((key) => (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground">
                        {metricLabels[key]}
                      </p>
                      <div className="mt-2">
                        <MetricValue
                          metric={formation.metrics[key]}
                          metricKey={key}
                          className="text-2xl font-medium tracking-tight"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold">L’établissement</h2>
                <dl className="mt-4 space-y-4 text-xs">
                  {[
                    ["Statut", formation.status],
                    ["Région", formation.region],
                    ["Département", formation.department],
                    ["Identifiant source", formation.sourceFormationId],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-1 leading-5">
                        {value ?? "Non publié"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {formation.parcoursupUrl ? (
                  <ButtonLink
                    href={formation.parcoursupUrl}
                    variant="secondary"
                    size="sm"
                    className="mt-5 w-full rounded-lg"
                  >
                    Fiche Parcoursup
                    <ArrowUpRight className="size-3.5" />
                  </ButtonLink>
                ) : (
                  <p className="mt-5 text-[11px] text-muted-foreground">
                    Lien Parcoursup indisponible
                  </p>
                )}
                <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                  Une fiche historique peut mener vers la fiche actuelle.
                </p>
              </section>
              <SourceDisclosure source={source} />
            </aside>
          </Reveal>
        </TabsContent>
        <TabsContent value="historique" keepMounted={false}>
          <History detail={detail} />
        </TabsContent>
        <TabsContent value="source">
          <Reveal className="max-w-3xl space-y-5">
            <SourceDisclosure source={source} />
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-4 text-sm font-semibold">
                Comprendre chaque indicateur
              </h2>
              <BouncyAccordion
                classNames={{
                  item: "border-border",
                  trigger: "py-3",
                  title: "text-xs",
                  description: "text-xs leading-6",
                }}
                items={[
                  ...detail.definitions.map((definition) => ({
                    id: definition.key,
                    title: definition.label,
                    description: (
                      <div>
                        <p>{definition.description}</p>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Champ source : {definition.field} · Unité :{" "}
                          {definition.unit === "percent" ? "%" : "effectif"}
                        </p>
                      </div>
                    ),
                  })),
                  {
                    id: "methodology",
                    title: "Périmètre et précautions de lecture",
                    description: (
                      <div className="space-y-3">
                        {detail.notices.map((notice) => (
                          <p key={notice}>{notice}</p>
                        ))}
                      </div>
                    ),
                  },
                  {
                    id: "missing-values",
                    title: "Valeurs absentes, masquées et invalides",
                    description: (
                      <p>
                        « Non publié » indique une valeur absente ; « Masqué »
                        une valeur masquée par la source ; « Invalide » une
                        valeur qui ne respecte pas son format. Un zéro publié
                        reste un zéro.
                      </p>
                    ),
                  },
                ]}
              />
            </section>
          </Reveal>
        </TabsContent>
      </Tabs>
      <ComparisonTray />
    </main>
  );
}
