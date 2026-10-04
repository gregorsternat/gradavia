"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { FormationSelectionProvider } from "@/features/formations/ui/selection-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">
        <FormationSelectionProvider>{children}</FormationSelectionProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
