"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionActive } from "./use-reduced-motion";

/** One in-flight batch per identity, with cancellation on disposal or hidden panels. */
export function useIncrementalRows<T>({
  identity,
  initial,
  request,
}: {
  identity: string;
  initial: T[];
  request: (rows: T[], signal: AbortSignal, all: boolean) => Promise<T[]>;
}) {
  const active = useMotionActive();
  const [state, setState] = useState({
    identity,
    rows: initial,
    loading: false,
    error: null as string | null,
  });
  const current =
    state.identity === identity
      ? state
      : { identity, rows: initial, loading: false, error: null };
  if (state.identity !== identity) setState(current);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [identity, active],
  );
  const loadMore = async (all = false): Promise<T[] | null> => {
    if (!active || inFlight.current) return null;
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ ...current, loading: true, error: null });
    try {
      const rows = await request(current.rows, controller.signal, all);
      if (controller.signal.aborted) return null;
      setState({ identity, rows, loading: false, error: null });
      return rows;
    } catch (error) {
      if (!controller.signal.aborted)
        setState({
          ...current,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Le chargement a échoué. Réessayez.",
        });
      return null;
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (controller.signal.aborted)
          setState((value) => ({ ...value, loading: false }));
      }
    }
  };
  return { ...current, loadMore };
}
