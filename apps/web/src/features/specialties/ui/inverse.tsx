"use client";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Download } from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
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
import {
  BarChart,
  type TooltipProps,
} from "@/components/charts/tremor/components/BarChart/BarChart";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import {
  MetricValue,
  SelectField,
  ShareButton,
} from "../../formations/ui/shared";
import { datasetUrl } from "../../formations/domain/explorer";
import { formatCount } from "../../formations/domain/metrics";
import {
  indicatorLabels,
  parseIndicator,
  observed,
  specialtiesUrl,
  type SpecialtyIndicator,
} from "../domain/explorer";
import {
  inverseCsv,
  inverseUrl,
  type InverseData,
  type InverseResult,
  type InverseRow,
} from "../domain/inverse";

function PairTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload[0]) return null;
  return (
    <div className="max-w-72 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
      <p className="leading-5">{String(payload[0].payload.fullLabel)}</p>
      <p className="mt-2 font-medium">
        {formatCount(payload[0].value)} candidats
      </p>
    </div>
  );
}
function ReadyInverse({
  data,
  initialIndicator,
}: {
  data: InverseData;
  initialIndicator: SpecialtyIndicator;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const indicator = searchParams
    ? searchParams.has("tri")
      ? parseIndicator(searchParams.get("tri") ?? undefined)
      : "accepted"
    : initialIndicator;
  const selected = data.formations.find(
    (row) => row.id === data.query.formation,
  );
  const rows = [...data.rows].sort(
    (a, b) =>
      (observed(b[indicator]) ?? -1) - (observed(a[indicator]) ?? -1) ||
      a.pair.label.localeCompare(b.pair.label, "fr"),
  );
  const chartRows = rows
    .filter((row) => observed(row[indicator]) !== null)
    .slice(0, 12)
    .map((row, index) => ({
      label: String(index + 1).padStart(2, "0"),
      fullLabel: row.pair.label,
      [indicatorLabels[indicator]]: observed(row[indicator]),
    }));
  const columns: TableColumn<InverseRow>[] = [
    {
      key: "pair",
      header: "Combinaison de spécialités",
      width: "55%",
      cell: (row) => (
        <Link
          href={specialtiesUrl(row.pair.id, row.group, indicator)}
          className="block text-xs leading-5 whitespace-normal hover:underline"
        >
          {row.pair.label}
        </Link>
      ),
    },
    ...(["applications", "offers", "accepted"] as const).map((key) => ({
      key,
      header: (
        <span className="block text-[10px] leading-4 whitespace-normal">
          {indicatorLabels[key]}
        </span>
      ),
      align: "right" as const,
      cell: (row: InverseRow) => (
        <MetricValue
          metric={row[key]}
          metricKey="applications"
          className="text-xs"
        />
      ),
    })),
  ];
  return (
    <main id="contenu" className="min-w-0 flex-1 py-8" aria-busy={pending}>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/specialites"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <ArrowLeft className="size-3" />
            Spécialités du bac
          </Link>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">
            Quelles spécialités dans cette filière ?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Combinaisons représentées parmi les bacheliers généraux, par libellé
            national de formation. Campagne {data.source.campaign}.
          </p>
        </div>
        <ShareButton />
      </div>
      <Combobox
        value={data.query.formation}
        onValueChange={(value) =>
          startTransition(() => router.push(inverseUrl(value, indicator)))
        }
        disabled={pending}
        className="mb-6 max-w-3xl"
      >
        <ComboboxTrigger className="min-h-12 rounded-xl bg-surface">
          <ComboboxInput
            aria-label="Libellé national de formation"
            placeholder="Rechercher une formation…"
            className="text-sm"
          />
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxList ariaLabel="Libellés nationaux de formation">
            {data.formations.map((row) => (
              <ComboboxItem
                key={row.id}
                value={row.id}
                textValue={`${row.label} · ${row.group}`}
                className="text-xs leading-5"
              >
                {row.label} · {row.group}
              </ComboboxItem>
            ))}
            <ComboboxEmpty>Aucun libellé ne correspond.</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {data.requestNotices.map((notice) => (
        <p key={notice} role="status" className="mb-4 text-sm">
          {notice}
        </p>
      ))}
      {!selected ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Choisissez un libellé pour voir toutes ses combinaisons publiées.
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selected.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.group} · {rows.length} lignes publiées · Périmètre
                national
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SelectField
                label="Indicateur des spécialités"
                disabled={pending}
                value={indicator}
                onChange={(value) => {
                  const next = value as SpecialtyIndicator;
                  window.history.replaceState(
                    null,
                    "",
                    inverseUrl(data.query.formation, next),
                  );
                }}
                options={Object.entries(indicatorLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
                className="w-52"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([inverseCsv(data)], {
                      type: "text/csv;charset=utf-8;",
                    }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "gradavia-specialites-par-formation.csv";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                <Download className="size-3.5" />
                Exporter
              </Button>
            </div>
          </div>
          {chartRows.length > 0 && (
            <section className="mb-5 rounded-xl border border-border bg-surface p-5">
              <h3 className="text-sm font-medium">
                {indicatorLabels[indicator]} · Effectifs publiés
              </h3>
              <BarChart
                data={chartRows}
                index="label"
                categories={[indicatorLabels[indicator]]}
                colors={["charcoal"]}
                layout="vertical"
                showLegend={false}
                yAxisWidth={28}
                valueFormatter={formatCount}
                customTooltip={PairTooltip}
                className="mt-4"
                style={{ height: Math.max(180, chartRows.length * 34) }}
              />
              <ol className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                {chartRows.map((row) => (
                  <li key={row.label} className="flex gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      {row.label}
                    </span>
                    <span>{row.fullLabel}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                {chartRows.length} combinaisons aux effectifs les plus élevés.
                Toutes les lignes et les valeurs non publiées figurent
                ci-dessous.
              </p>
            </section>
          )}
          <Table
            aria-label="Combinaisons par formation nationale"
            data={rows}
            columns={columns}
            getRowId={(row) => row.id}
            rowHeight={76}
            height={Math.min(650, rows.length * 76 + 68)}
            className="rounded-xl bg-surface"
          />
        </>
      )}
      <BouncyAccordion
        className="mt-6 max-w-3xl"
        classNames={{
          item: "border-0 bg-transparent",
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
                {data.notices.map((notice) => (
                  <p key={notice}>{notice}</p>
                ))}
                <p>
                  {data.source.provider} · {data.source.license} · Version{" "}
                  {data.source.releaseId}
                </p>
                <a
                  href={datasetUrl(data.source.datasetId)}
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  Consulter le jeu source
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
            ),
          },
        ]}
      />
    </main>
  );
}
export function InverseSpecialties({
  result,
  indicator,
}: {
  result: InverseResult;
  indicator: SpecialtyIndicator;
}) {
  if (result.status === "ready")
    return <ReadyInverse data={result.data} initialIndicator={indicator} />;
  return (
    <main id="contenu" className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Spécialités par formation
      </h1>
      <p role="status" className="mt-8 text-sm text-muted-foreground">
        {result.status === "empty"
          ? "Aucune campagne de spécialités publiée."
          : "Les données sont temporairement indisponibles."}
      </p>
      <ButtonLink
        href="/specialites/inverse"
        variant="secondary"
        className="mt-4"
      >
        Réessayer
      </ButtonLink>
    </main>
  );
}
