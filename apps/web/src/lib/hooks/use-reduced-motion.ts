"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

const MotionActivity = createContext(true);
export const MotionActivityProvider = MotionActivity.Provider;

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
  const active = useContext(MotionActivity);
  const reduced = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  return reduced || !active;
}
