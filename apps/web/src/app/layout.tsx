import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { AppShell } from "@/features/navigation/ui/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gradavia — L’observatoire de l’orientation",
    template: "%s · Gradavia",
  },
  description:
    "Explorez les données publiques de Parcoursup, comparez les formations et construisez votre sélection. Capacités, admissions et taux d’accès, avec leurs sources.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <a
            href="#contenu"
            className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-foreground px-4 py-3 text-background focus:not-sr-only"
          >
            Aller au contenu
          </a>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
