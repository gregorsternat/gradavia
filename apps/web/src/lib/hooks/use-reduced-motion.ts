"use client";

import { useSyncExternalStore } from "react";

const mediaQuery = "(prefers-reduced-motion: reduce)";
const serverSnapshot = () => false;
const clientSnapshot = () => window.matchMedia(mediaQuery).matches;

function subscribe(listener: () => void) {
  const media = window.matchMedia(mediaQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** Keep initial markup deterministic, then react to the user's motion setting. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
