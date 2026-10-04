"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/motion/button/base";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="flex min-h-[65vh] flex-col items-start justify-center gap-6 py-16"
    >
      <h1 className="text-3xl tracking-tight">
        La page n’a pas pu s’afficher.
      </h1>
      <Button variant="secondary" onClick={retry} className="w-fit rounded-lg">
        <RefreshCw className="size-4" aria-hidden="true" />
        Réessayer
      </Button>
    </main>
  );
}
