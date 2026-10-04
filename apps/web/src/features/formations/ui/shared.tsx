"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Copy,
  Download,
  GitCompareArrows,
  MapPin,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Button, ButtonLink } from "@/components/motion/button/base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Tooltip } from "@/components/motion/tooltip";
import type {
  CampaignSource,
  Formation,
  Metric,
  MetricKey,
} from "../domain/api-contract";
import { datasetUrl } from "../domain/explorer";
import {
  formatMetric,
  formatCount,
  formationUrl,
  formationsCsv,
  percentMetrics,
} from "../domain/metrics";
import { selectionUrl } from "../domain/selection";
import { useFormationSelection } from "./selection-provider";

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      className={className}
    >
      <SelectTrigger
        aria-label={label}
        className="h-10 w-full min-w-0 rounded-lg bg-surface px-3 text-xs"
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto">
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 1, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
export function MetricValue({
  metric,
  metricKey,
  animated = false,
  className = "",
}: {
  metric: Metric;
  metricKey: MetricKey;
  animated?: boolean;
  className?: string;
}) {
  if (metric.state !== "observed" || metric.value === null)
    return (
      <span
        className={`text-muted-foreground ${className}`}
        title={formatMetric(metric, metricKey)}
      >
        {metric.state === "suppressed"
          ? "Masqué"
          : metric.state === "invalid"
            ? "Invalide"
            : "—"}
      </span>
    );
  return (
    <span className={`tabular-nums ${className}`}>
      {animated ? (
        <NumberTicker
          value={metric.value}
          format={(value) =>
            percentMetrics.has(metricKey)
              ? new Intl.NumberFormat("fr-FR", {
                  maximumFractionDigits: 1,
                }).format(value)
              : formatCount(value)
          }
          precision={percentMetrics.has(metricKey) ? 1 : 0}
          duration={0.7}
        />
      ) : (
        formatMetric(metric, metricKey)
      )}
      {animated && percentMetrics.has(metricKey) ? (
        <span className="ml-1 text-[.6em] text-muted-foreground">%</span>
      ) : null}
    </span>
  );
}
export function FormationActions({
  formation,
  campaign,
  labels = false,
  comparisonSelected,
  onComparisonToggle,
  disabled = false,
}: {
  formation: Formation;
  campaign: number;
  labels?: boolean;
  comparisonSelected?: boolean;
  onComparisonToggle?: () => void;
  disabled?: boolean;
}) {
  const selection = useFormationSelection();
  const saved = selection.favorites.includes(formation.id);
  const compared =
    comparisonSelected ?? selection.comparison.includes(formation.id);
  return (
    <div className="flex items-center gap-1">
      <Tooltip
        content={saved ? "Retirer des favoris" : "Enregistrer dans mes favoris"}
      >
        <Button
          size={labels ? "sm" : "icon"}
          variant="ghost"
          disabled={disabled}
          className="rounded-lg"
          aria-label={`${saved ? "Retirer des favoris" : "Ajouter aux favoris"} : ${formation.title}`}
          aria-pressed={saved}
          onClick={() => selection.toggleFavorite(formation, campaign)}
        >
          <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} />
          {labels ? (saved ? "Enregistré" : "Enregistrer") : null}
        </Button>
      </Tooltip>
      <Tooltip
        content={compared ? "Retirer du comparateur" : "Ajouter au comparateur"}
      >
        <Button
          size={labels ? "sm" : "icon"}
          variant={compared ? "secondary" : "ghost"}
          disabled={disabled}
          className="rounded-lg"
          aria-label={`${compared ? "Retirer du comparateur" : "Comparer"} : ${formation.title}`}
          aria-pressed={compared}
          onClick={
            onComparisonToggle ??
            (() => selection.toggleComparison(formation, campaign))
          }
        >
          <GitCompareArrows className="size-4" />
          {labels ? (compared ? "Sélectionnée" : "Comparer") : null}
        </Button>
      </Tooltip>
    </div>
  );
}
export function ExportButton({
  rows,
  filename = "gradavia-formations",
  label = "Exporter cette page",
}: {
  rows: { formation: Formation; source: CampaignSource }[];
  filename?: string;
  label?: string;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="rounded-lg"
      disabled={!rows.length}
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([formationsCsv(rows)], { type: "text/csv;charset=utf-8;" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filename}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <Download className="size-3.5" />
      {label}
    </Button>
  );
}
export function ShareButton() {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        className="rounded-lg"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setState("copied");
          } catch {
            setState("error");
          }
        }}
      >
        {state === "copied" ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        {state === "copied" ? "Lien copié" : "Partager"}
      </Button>
      {state === "error" && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Copiez l’adresse de cette page depuis votre navigateur.
        </p>
      )}
    </div>
  );
}
export function SourceDisclosure({
  source,
  compact = false,
}: {
  source: CampaignSource;
  compact?: boolean;
}) {
  const date = (value: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeZone: "Europe/Paris",
    }).format(new Date(value));
  return (
    <BouncyAccordion
      className={compact ? "max-w-2xl" : ""}
      classNames={{
        item: compact
          ? "border-0 bg-transparent"
          : "rounded-xl border border-border bg-surface",
        trigger: compact ? "px-0 py-1" : "p-5",
        title: "text-xs font-medium",
        description: compact
          ? "px-0 pb-2 text-xs leading-6 text-muted-foreground"
          : "px-5 pb-5 text-xs leading-6 text-muted-foreground",
      }}
      items={[
        {
          id: `source-${source.releaseId}`,
          title: `Source et périmètre · Parcoursup ${source.campaign}`,
          description: (
            <div className="space-y-2">
              <p>
                {source.provider} · Hors apprentissage · {source.license}
              </p>
              <p>
                Collecte du {date(source.collectedAt)}. Mise à jour source :{" "}
                {source.modifiedAt ? date(source.modifiedAt) : "non renseignée"}
                .
              </p>
              <p>
                Un enregistrement correspond à une formation, un établissement
                et une campagne. Les candidatures ne représentent pas des
                personnes uniques.
              </p>
              <a
                className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
                href={datasetUrl(source.datasetId)}
              >
                Consulter le jeu de données <ArrowUpRight className="size-3" />
              </a>
            </div>
          ),
        },
      ]}
    />
  );
}
export function FormationCard({
  formation,
  source,
  actionsDisabled = false,
}: {
  formation: Formation;
  source: CampaignSource;
  actionsDisabled?: boolean;
}) {
  return (
    <article className="group flex h-full min-w-0 flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-foreground/25">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="inline-flex max-w-[65%] truncate rounded-md bg-subtle px-2 py-1 text-[10px] font-medium">
          {formation.type ?? "Type non renseigné"}
        </span>
        <FormationActions
          formation={formation}
          campaign={source.campaign}
          disabled={actionsDisabled}
        />
      </div>
      <Link href={formationUrl(formation.id)} className="group/title">
        <h2 className="text-[15px] leading-6 font-semibold tracking-tight text-balance group-hover/title:underline">
          {formation.title}
        </h2>
      </Link>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {formation.establishment ?? "Établissement non renseigné"}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="size-3 shrink-0" />
        {formation.city ?? "Ville non renseignée"}
        {formation.department ? ` · ${formation.department}` : ""}
      </p>
      <div className="mt-auto pt-6">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["capacity", "Places"],
              ["applications", "Candidatures"],
              ["accessRate", "Accès"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <p className="mb-1 text-[10px] text-muted-foreground">{label}</p>
              <MetricValue
                metric={formation.metrics[key]}
                metricKey={key}
                className="text-base font-medium tracking-tight"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate">
            {formation.status ?? "Statut non publié"}
          </span>
          <Link
            href={formationUrl(formation.id)}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground"
          >
            Voir la formation <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function ComparisonTray() {
  const { comparison, comparisonRecords, clearComparison } =
    useFormationSelection();
  if (!comparison.length) return null;
  return (
    <Reveal className="sticky bottom-5 z-30 mx-auto mt-6 max-w-xl">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-foreground p-3 text-background shadow-xl">
        <div className="flex items-center gap-3 pl-2">
          <GitCompareArrows className="size-4" />
          <p className="text-xs">
            <span className="font-semibold">{comparison.length} / 4</span>{" "}
            sélectionnées
            <span className="hidden text-background/60 sm:inline">
              {" "}
              · {comparisonRecords[0]?.campaign}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ButtonLink
            size="sm"
            href={selectionUrl(comparison)}
            className="rounded-lg bg-background text-foreground hover:bg-background/90"
          >
            Comparer <ArrowRight className="size-3.5" />
          </ButtonLink>
          <Button
            size="icon"
            variant="ghost"
            className="text-background/70 hover:bg-background/10 hover:text-background"
            aria-label="Vider la sélection"
            onClick={clearComparison}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </Reveal>
  );
}
