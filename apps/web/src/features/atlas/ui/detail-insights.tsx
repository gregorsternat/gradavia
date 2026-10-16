"use client";
import { PanelMain } from "@/features/workspace/ui/navigation";
import { Breadcrumbs } from "@/features/seo/ui/breadcrumbs";
import { detailBreadcrumbs } from "@/features/seo/domain/structured-data";
import Link from "@/features/workspace/ui/navigation";
import { useState } from "react";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import {
  AsyncTable as Table,
  type TableColumn,
} from "@/components/motion/table/async";
import { ButtonLink } from "@/components/motion/button/base";
import { SelectField } from "@/features/formations/ui/shared";
import { formatCount } from "@/features/formations/domain/metrics";
import type { Metric } from "@/features/formations/domain/api-contract";
import type { AtlasDetail } from "../domain/api-contract";
import {
  atlasItemUrl,
  familyLabels,
  type peerSummary,
} from "../domain/exploration";

type Peers = ReturnType<typeof peerSummary>;
const readable = (metric?: Metric, percent = false) =>
  metric?.state === "observed" && metric.value !== null
    ? `${metric.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${percent ? " %" : ""}`
    : metric?.state === "suppressed"
      ? "Masqué"
      : metric?.state === "invalid"
        ? "Invalide"
        : "Non publié";
const groups = {
  mentions: {
    title: "Mentions au baccalauréat",
    keys: [
      "mentionNone",
      "mentionFair",
      "mentionGood",
      "mentionVeryGood",
      "mentionHighest",
      "mentionUnknown",
    ],
  },
  candidats: {
    title: "Profils des candidats",
    keys: [
      "generalApplications",
      "technologyApplications",
      "vocationalApplications",
      "otherApplications",
    ],
  },
  propositions: {
    title: "Profils recevant une proposition",
    keys: [
      "generalOffers",
      "technologyOffers",
      "vocationalOffers",
      "otherOffers",
    ],
  },
  admis: {
    title: "Profils des admis",
    keys: [
      "generalAdmitted",
      "technologyAdmitted",
      "vocationalAdmitted",
      "otherAdmitted",
    ],
  },
  jalons: {
    title: "Quand les admis ont reçu leur proposition",
    keys: ["admittedAtOpening", "admittedBeforeBac", "admittedBeforeEnd"],
  },
} as const;

export function DetailInsights({
  detail,
  peers,
}: {
  detail: AtlasDetail;
  peers?: Peers;
}) {
  const [group, setGroup] = useState<keyof typeof groups>("mentions");
  const config = groups[group];
  const rows = config.keys.map((key) => ({
    key,
    label:
      detail.definitions.find((definition) => definition.key === key)?.label ??
      key,
    metric: detail.metrics[key],
  }));
  const columns: TableColumn<(typeof rows)[number]>[] = [
    {
      key: "label",
      header: "Population",
      cell: (row) => <span className="text-xs">{row.label}</span>,
    },
    {
      key: "value",
      header: "Effectif",
      align: "right",
      cell: (row) => (
        <span className="text-xs tabular-nums">{readable(row.metric)}</span>
      ),
    },
  ];
  const ranks = [...detail.history]
    .sort((a, b) => a.campaign - b.campaign)
    .flatMap((year) =>
      year.rankGroups.map((rank) => ({
        ...rank,
        campaign: year.campaign,
        continuity: year.continuity,
      })),
    );
  return (
    <div className="space-y-6">
      {detail.family !== "apb" && (
        <ButtonLink
          href={`/modalites?${detail.family === "parcoursup" ? "classique" : "apprenti"}=${encodeURIComponent(detail.item.id)}&campagne=${detail.source.campaign}`}
          variant="secondary"
          size="sm"
        >
          Comparer hors apprentissage et apprentissage
        </ButtonLink>
      )}
      {detail.family === "parcoursup" && (
        <ButtonLink href="/specialites/inverse" variant="secondary" size="sm">
          Spécialités des admis par famille de formation · France entière
        </ButtonLink>
      )}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">{config.title}</h2>
          </div>
          <SelectField
            label="Population détaillée"
            value={group}
            onChange={(value) => setGroup(value as keyof typeof groups)}
            options={Object.entries(groups).map(([value, row]) => ({
              value,
              label: row.title,
            }))}
            className="w-60 max-w-full"
          />
        </div>
        {rows.some((row) => row.metric?.state === "observed") && (
          <BarChart
            className="gradavia-chart my-6 h-72"
            data={rows.map((row) => ({
              Population: row.label,
              Effectif:
                row.metric?.state === "observed" ? row.metric.value : null,
            }))}
            index="Population"
            categories={["Effectif"]}
            colors={["charcoal"]}
            showLegend={false}
            valueFormatter={formatCount}
            allowDecimals={false}
          />
        )}
        <Table
          aria-label={config.title}
          data={rows}
          columns={columns}
          getRowId={(row) => row.key}
          rowHeight={48}
          height={rows.length * 48 + 48}
          className="mt-4 rounded-lg [&_table]:min-w-[340px]"
        />
      </section>
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold">
          Origine géographique des admis
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {["localShare", "localIdfShare", "sameSchoolShare"].map((key) => (
            <div key={key}>
              <p className="text-xs text-muted-foreground">
                {detail.definitions.find((definition) => definition.key === key)
                  ?.label ?? key}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {readable(detail.metrics[key], true)}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Rang du dernier appelé</h2>
        <div className="mt-5 space-y-3">
          {detail.rankGroups.map((rank) => (
            <div
              key={rank.field}
              className="flex justify-between gap-4 text-sm"
            >
              <span>{rank.label ?? "Groupe non renseigné"}</span>
              <span className="tabular-nums">{readable(rank.rank)}</span>
            </div>
          ))}
        </div>
        {ranks.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-medium">
              Historique par groupe
            </summary>
            <Table
              aria-label="Rangs historiques par groupe"
              className="mt-3 [&_table]:min-w-[560px]"
              data={ranks}
              getRowId={(row) => `${row.campaign}:${row.field}`}
              rowHeight={48}
              height={Math.min(480, ranks.length * 48 + 48)}
              columns={[
                {
                  key: "campaign",
                  header: "Campagne",
                  cell: (row) => <span>{row.campaign}</span>,
                },
                {
                  key: "label",
                  header: "Groupe publié",
                  cell: (row) => (
                    <span className="text-xs">
                      {row.label ?? "Non renseigné"}
                    </span>
                  ),
                },
                {
                  key: "rank",
                  header: "Dernier appelé",
                  align: "right",
                  cell: (row) => <span>{readable(row.rank)}</span>,
                },
                {
                  key: "continuity",
                  header: "Continuité",
                  cell: (row) => (
                    <span className="text-xs">
                      {row.continuity === "same-source-identity"
                        ? "Identité concordante"
                        : row.continuity === "changed-description"
                          ? "Description modifiée"
                          : "Non établie"}
                    </span>
                  ),
                },
              ]}
            />
          </details>
        )}
      </section>
      {peers && (
        <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold">
            Parmi les formations similaires
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatCount(peers.count)} autres formations de même type (
            {detail.item.type ?? "non renseigné"}) et de même sélectivité
            publiée, campagne {detail.source.campaign}.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {peers.positions.map((position) => (
              <div key={position.key}>
                <p className="text-xs text-muted-foreground">
                  {
                    detail.definitions.find(
                      (definition) => definition.key === position.key,
                    )?.label
                  }
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {position.value === null
                    ? "Non publié"
                    : `${position.value.toLocaleString("fr-FR")}${position.key === "accessRate" ? " %" : ""}`}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {position.median === null
                    ? "Aucune médiane disponible"
                    : `Médiane des formations : ${position.median.toLocaleString("fr-FR")}${position.key === "accessRate" ? " %" : ""}`}{" "}
                  · {position.count} valeurs publiées.
                </p>
                {position.below !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {position.below} valeurs strictement inférieures.
                  </p>
                )}
              </div>
            ))}
          </div>
          <h3 className="mt-7 text-sm font-medium">
            Autres formations à explorer
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {peers.alternatives.map((row) => (
              <Link
                href={atlasItemUrl(row, detail.family)}
                key={row.id}
                className="rounded-lg bg-subtle p-3 hover:bg-subtle/70"
              >
                <p className="text-xs font-medium">{row.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.establishment} · {row.city ?? row.region}
                </p>
              </Link>
            ))}
          </div>
          <ButtonLink
            variant="secondary"
            size="sm"
            className="mt-4"
            href={`/carte?famille=${detail.family}&campagne=${detail.source.campaign}&version=${detail.source.releaseId}&similaire=${encodeURIComponent(detail.item.id)}`}
          >
            Explorer toutes les alternatives
          </ButtonLink>
        </section>
      )}
    </div>
  );
}

export function AtlasDetailView({
  detail,
  peers,
}: {
  detail: AtlasDetail;
  peers?: Peers;
}) {
  return (
    <PanelMain id="contenu" className="py-8">
      <Breadcrumbs
        items={detailBreadcrumbs(detail.item, detail.source, detail.family)}
      />
      <Link
        href={`/carte?famille=${detail.family}&campagne=${detail.source.campaign}`}
        className="text-xs text-muted-foreground hover:underline"
      >
        {familyLabels[detail.family]}
      </Link>
      <div className="mb-7 mt-5">
        <p className="mb-3 text-xs text-muted-foreground">
          Campagne {detail.source.campaign} · {detail.item.type}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {detail.item.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {detail.item.establishment} ·{" "}
          {detail.item.city ?? detail.item.department ?? detail.item.region}
        </p>
      </div>
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        {["capacity", "applications", "offers"].map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <p className="text-xs text-muted-foreground">
              {
                detail.definitions.find((definition) => definition.key === key)
                  ?.label
              }
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {readable(detail.metrics[key])}
            </p>
          </div>
        ))}
      </div>
      <DetailInsights detail={detail} peers={peers} />
    </PanelMain>
  );
}
