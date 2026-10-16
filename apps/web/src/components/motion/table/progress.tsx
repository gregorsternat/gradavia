"use client";

import { useEffect, useRef } from "react";
import { useMotionActive } from "@/lib/hooks/use-reduced-motion";
import { Skeleton } from "@/components/skeleton";
import { Button } from "@/components/motion/button/base";

export type ProgressProps = {
  count: number;
  total: number;
  hasMore: boolean;
  loading?: boolean;
  error?: string | null;
  onLoadMore: () => void;
  automatic?: boolean;
  active?: boolean;
  retryLabel?: string;
};

/** Shared progress and retry; cards observe this sentinel, tables own scrolling. */
export function LoadProgress({
  count,
  total,
  hasMore,
  loading = false,
  error,
  onLoadMore,
  automatic = false,
  active = true,
  retryLabel = "Réessayer",
}: ProgressProps) {
  const panelActive = useMotionActive();
  const sentinel = useRef<HTMLDivElement>(null);
  const enabled = panelActive && active;
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !automatic || !enabled || loading || error || !hasMore)
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin: "160px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [automatic, enabled, loading, error, hasMore, onLoadMore]);
  return (
    <div
      ref={sentinel}
      className="mt-3 flex flex-wrap items-center justify-between gap-3"
      data-load-progress
    >
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {count.toLocaleString("fr-FR")}{" "}
        {count === 1 ? "résultat affiché" : "résultats affichés"} sur{" "}
        {total.toLocaleString("fr-FR")}
        {loading ? (
          <span className="sr-only"> · Chargement…</span>
        ) : !hasMore && !error ? (
          " · Fin des résultats"
        ) : (
          ""
        )}
      </p>
      {loading && <Skeleton className="h-1 w-16" />}
      {error && (
        <p role="alert" className="w-full text-sm text-muted-foreground">
          {error}
        </p>
      )}
      {error && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!enabled || loading}
          onClick={onLoadMore}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
