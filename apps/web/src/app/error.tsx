"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      id="contenu"
      className="flex flex-1 flex-col justify-center gap-6 py-24"
    >
      <h1 className="text-3xl tracking-tight">
        La page n’a pas pu s’afficher.
      </h1>
      <button
        onClick={reset}
        className="w-fit rounded-md border border-border px-4 py-2"
      >
        Réessayer
      </button>
    </main>
  );
}
