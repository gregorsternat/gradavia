"use client";
import { useEffect, useState } from "react";
import { LoadingStatus } from "@/components/skeleton";
import { InsightsSkeleton } from "./loading";
import { Button } from "@/components/motion/button/base";
import type { FormationInsightsResult } from "../domain/insights";
import type { DetailInsights } from "../../atlas/ui/detail-insights";

type Loaded = {
  data: Extract<FormationInsightsResult, { status: "ready" }>["data"];
  View: typeof DetailInsights;
};

export function FormationInsights({
  id,
  active,
  requested,
}: {
  id: string;
  active: boolean;
  requested: boolean;
}) {
  const [loaded, setLoaded] = useState<Loaded>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    const controller = new AbortController();
    // Start both immediately; leaving the tab keeps the in-flight result for this visit.
    void Promise.all([
      import("../../atlas/ui/detail-insights"),
      fetch(`/api/formations/${encodeURIComponent(id)}/insights`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Insights unavailable");
        const result = (await response.json()) as FormationInsightsResult;
        if (result.status !== "ready" || result.data.detail.item.id !== id)
          throw new Error("Invalid insights");
        return result.data;
      }),
    ])
      .then(([module, data]) => {
        if (!cancelled) setLoaded({ data, View: module.DetailInsights });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, requested, attempt]);
  if (!active) return null;
  if (loaded)
    return (
      <loaded.View detail={loaded.data.detail} peers={loaded.data.peers} />
    );
  if (failed)
    return (
      <div role="alert" className="panel p-5">
        <p>Les profils et alternatives sont temporairement indisponibles.</p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  return (
    <div className="py-8" aria-busy="true" data-skeleton="insights">
      <LoadingStatus label="Chargement des profils et alternatives…" />
      <div aria-hidden="true">
        <InsightsSkeleton />
      </div>
    </div>
  );
}
