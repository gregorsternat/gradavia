import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { AppShell } from "@/features/navigation/ui/app-shell";
import { SITE_URL, pages } from "@/features/seo/domain/metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gradavia — Formations et statistiques Parcoursup",
    template: "%s · Gradavia",
  },
  description: pages["/"].description,
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      data-gradavia-publication={process.env.GRADAVIA_PUBLICATION_ID}
      suppressHydrationWarning
    >
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
