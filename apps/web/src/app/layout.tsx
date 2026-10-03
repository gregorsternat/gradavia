import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { ThemeSelect } from "@/components/theme-select";
import { Wordmark } from "@/components/wordmark";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Orvio — Une autre lecture de l’orientation",
    template: "%s · Orvio",
  },
  description:
    "Explorez les formations Parcoursup à partir des données publiques de l’orientation, avec leurs sources et leur contexte.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <a
            href="#contenu"
            className="sr-only fixed left-4 top-4 z-50 rounded-md bg-foreground px-4 py-3 text-background focus:not-sr-only"
          >
            Aller au contenu
          </a>
          <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-6 sm:px-10">
            <header className="flex h-24 items-center justify-between border-b border-border">
              <Wordmark />
              <div className="flex items-center gap-4 sm:gap-7">
                <nav aria-label="Navigation principale">
                  <Link
                    href="/formations"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    Formations
                  </Link>
                </nav>
                <ThemeSelect />
              </div>
            </header>
            {children}
            <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-border py-7 text-xs text-muted-foreground">
              <span>Un projet indépendant. Des données publiques.</span>
              <a
                href="https://github.com/gregorsternat/orvio"
                className="inline-flex items-center gap-2 underline-offset-4 hover:text-foreground hover:underline"
              >
                Suivre le projet <span aria-hidden="true">↗</span>
              </a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
