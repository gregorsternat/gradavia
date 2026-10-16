import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Decorative, deterministic placeholders shared by server and client views. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton h-3 rounded-md", className)}
    />
  );
}

export function LoadingStatus({
  label = "Chargement en cours…",
}: {
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="sr-only">
      {label}
    </span>
  );
}

export function SkeletonPage({
  title,
  children,
  name,
}: {
  title: string;
  children: ReactNode;
  name: string;
}) {
  return (
    <section
      aria-label={title}
      aria-busy="true"
      data-skeleton={name}
      className="min-w-0 space-y-7 py-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">{title}</h1>
        <Skeleton className="h-9 w-32" />
      </div>
      <LoadingStatus label={`Chargement · ${title}`} />
      <div aria-hidden="true" className="min-w-0 space-y-6">
        {children}
      </div>
    </section>
  );
}

export function SkeletonFilters({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("h-10", i === 0 && "sm:col-span-2")} />
      ))}
    </div>
  );
}

export function SkeletonMetrics({ count = 3 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4",
        count === 4 ? "lg:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl bg-sidebar p-5">
          <Skeleton className="w-24 max-w-full" />
          <Skeleton className="mt-5 h-8 w-28 max-w-full" />
          <Skeleton className="mt-3 h-2 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({
  className,
  bars = false,
}: {
  className?: string;
  bars?: boolean;
}) {
  return (
    <div className={cn("panel min-w-0 p-5", className)}>
      <Skeleton className="w-36 max-w-full" />
      <div className="mt-7 flex h-52 items-end gap-3 border-b border-l border-border px-4 pb-3">
        {bars ? (
          ["h-2/5", "h-3/5", "h-1/2", "h-4/5", "h-3/5", "h-2/3"].map(
            (height, i) => (
              <Skeleton
                key={i}
                className={cn("flex-1 rounded-b-none", height)}
              />
            ),
          )
        ) : (
          <Skeleton className="h-full w-full rounded-lg" />
        )}
      </div>
      <Skeleton className="mt-4 h-2 w-40 max-w-full" />
    </div>
  );
}

export function SkeletonTable({
  columns = 4,
  rows = 6,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border"
      data-skeleton-table
    >
      {Array.from({ length: rows + 1 }, (_, row) => (
        <div
          key={row}
          className={cn(
            "grid gap-5 px-4 py-5",
            row === 0 ? "bg-sidebar" : "border-t border-border",
          )}
          style={{
            gridTemplateColumns: `minmax(0, 2fr) repeat(${columns - 1}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton
              key={col}
              className={cn(
                row === 0 ? "h-2 w-2/3" : "h-3",
                col > 0 && "ml-auto w-2/3",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          data-skeleton-card
          className="min-w-0 rounded-xl border border-border bg-surface p-5"
        >
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="mt-4 w-3/5" />
          <Skeleton className="mt-2 h-2 w-2/5" />
          <div className="mt-7 flex justify-between gap-5">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </>
  );
}

export function RefreshIndicator() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0"
      data-refresh-indicator
    >
      <Skeleton className="h-0.5 w-full rounded-none" />
      <LoadingStatus label="Actualisation des résultats…" />
    </div>
  );
}
