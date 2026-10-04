// Tremor cx [v0.0.0]
// Modified for Gradavia: repository formatting.

import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}
