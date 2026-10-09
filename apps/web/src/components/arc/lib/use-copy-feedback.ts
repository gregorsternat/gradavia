// Copyright (c) 2026 Elia Kuratli. MIT license: docs/licenses/arc.txt.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyFeedbackState = "idle" | "copied" | "error";

/** Shared clipboard state for actions that render their own button or menu. */
export function useCopyFeedback(duration = 1900) {
  const [state, setState] = useState<CopyFeedbackState>("idle");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operation = useRef(0);

  const reset = useCallback(() => {
    operation.current += 1;
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
    setState("idle");
    setActiveKey(null);
  }, []);

  useEffect(
    () => () => {
      operation.current += 1;
      if (timeout.current !== null) clearTimeout(timeout.current);
    },
    [],
  );

  const copy = useCallback(
    async (value: string, key = "default") => {
      const currentOperation = ++operation.current;
      if (timeout.current !== null) clearTimeout(timeout.current);
      timeout.current = null;
      setActiveKey(key);
      try {
        await navigator.clipboard.writeText(value);
        if (currentOperation !== operation.current) return false;
        setState("copied");
        timeout.current = setTimeout(() => {
          if (currentOperation === operation.current) reset();
        }, duration);
        return true;
      } catch {
        if (currentOperation === operation.current) setState("error");
        return false;
      }
    },
    [duration, reset],
  );

  return { state, activeKey, copy, reset };
}
