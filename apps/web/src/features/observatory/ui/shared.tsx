"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Database,
  Info,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/motion/select";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Table, type TableColumn } from "@/components/motion/table";
import { Tooltip } from "@/components/motion/tooltip";
import { NumberTicker } from "@/components/motion/number-ticker";
import { datasetUrl } from "@/features/formations/domain/explorer";
import type { CampaignSource } from "@/features/formations/domain/api-contract";
import { number, type Total, type OverviewResult } from "../domain/overview";

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 1, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.32, delay: reduce ? 0 : delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
export function CampaignSelect({
  campaign,
  campaigns,
  path,
}: {
  campaign: number;
  campaigns: number[];
  path: string;
}) {
  const router = useRouter();
  return (
    <Select
      value={String(campaign)}
      onValueChange={(v) => router.push(`${path}?campagne=${v}`)}
      className="min-w-40"
    >
      <SelectTrigger
        aria-label="Campagne d’admission"
        className="h-9 rounded-lg text-xs"
      >
        <span className="text-muted-foreground">Campagne</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {campaigns.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Stat({
  label,
  value,
  detail,
  definition,
}: {
  label: string;
  value: number | null;
  detail?: ReactNode;
  definition: string;
}) {
  return (
    <div className="min-w-0 py-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        <Tooltip content={definition}>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Définition : ${label}`}
          >
            <Info className="size-3" />
          </Button>
        </Tooltip>
      </div>
      <div className="mt-2 min-h-8 text-[clamp(1.5rem,2.8vw,2.5rem)] leading-none font-medium tracking-[-.065em] tabular-nums sm:mt-3 sm:min-h-10">
        {value === null ? (
          <span aria-label="Non disponible">—</span>
        ) : (
          <NumberTicker
            value={value}
            format={number}
            duration={0.55}
            stagger={0.015}
            startOnView={false}
          />
        )}
      </div>
      {detail && (
        <div className="mt-2 text-[11px] leading-5 text-muted-foreground sm:mt-3">
          {detail}
        </div>
      )}
    </div>
  );
}
export function CoverageNote({ total }: { total: Total }) {
  return total.observed < total.total ? (
    <span>
      Somme partielle · {number(total.observed)} / {number(total.total)} lignes
    </span>
  ) : (
    <span>Ensemble des lignes publiées</span>
  );
}
export function ChartData<T>({
  title,
  data,
  columns,
}: {
  title: string;
  data: T[];
  columns: TableColumn<T>[];
}) {
  return (
    <BouncyAccordion
      className="mt-3"
      classNames={{
        trigger: "min-h-8 py-2 px-0",
        item: "border-0 bg-transparent rounded-none shadow-none",
        title: "text-[11px] font-normal text-muted-foreground",
        description: "px-0 pb-0",
        content: "px-0",
      }}
      items={[
        {
          id: "values",
          title: "Voir les valeurs",
          description: (
            <Table
              aria-label={title}
              data={data}
              columns={columns}
              height={Math.min(350, data.length * 40 + 46)}
              rowHeight={40}
              className="text-xs"
            />
          ),
        },
      ]}
    />
  );
}
export function SourceLine({ source }: { source: CampaignSource }) {
  const date = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(source.modifiedAt ?? source.collectedAt));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
      <a
        href={datasetUrl(source.datasetId)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 hover:text-foreground"
      >
        <Database className="size-3" /> {source.provider}{" "}
        <ArrowUpRight className="size-3" />
      </a>
      <span>Campagne {source.campaign} · Hors apprentissage</span>
      <span>
        {source.modifiedAt ? "Source mise à jour" : "Collecté"} le {date}
      </span>
    </div>
  );
}
export function DataUnavailable({
  status,
  title,
}: {
  status: Exclude<OverviewResult["status"], "ready">;
  title: string;
}) {
  return (
    <main id="contenu" tabIndex={-1} className="py-8">
      <h1 className="page-title">{title}</h1>
      <div className="panel mt-8 flex min-h-80 flex-col items-center justify-center p-8 text-center">
        <Database
          className="mb-6 size-9 text-muted-foreground"
          strokeWidth={1.3}
        />
        <h2 className="text-lg font-medium">
          {status === "empty"
            ? "Aucune campagne disponible"
            : "Les données sont temporairement indisponibles"}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {status === "empty"
            ? "L’observatoire sera accessible dès la publication d’une campagne."
            : "La connexion aux données n’a pas pu aboutir. Réessayez dans un instant."}
        </p>
        <ButtonLink
          href=""
          variant="secondary"
          className="mt-6 rounded-lg text-xs"
        >
          <RefreshCw className="size-3.5" /> Réessayer
        </ButtonLink>
      </div>
    </main>
  );
}
export function DownloadButton({
  content,
  filename,
  label = "Exporter",
}: {
  content: () => string;
  filename: string;
  label?: string;
}) {
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([content()], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-9 rounded-lg"
      onClick={download}
    >
      <ArrowDownToLine className="size-3.5" />
      {label}
    </Button>
  );
}
