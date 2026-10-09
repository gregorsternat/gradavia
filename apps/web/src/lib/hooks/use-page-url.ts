"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const serverSnapshot = () => "";
const clientSnapshot = () => window.location.href;

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

/** Resolve share paths only after hydration and track client-side navigation. */
export function usePageUrl(href?: string) {
  usePathname();
  useSearchParams();
  const currentUrl = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  return currentUrl ? new URL(href ?? currentUrl, currentUrl).href : "";
}
