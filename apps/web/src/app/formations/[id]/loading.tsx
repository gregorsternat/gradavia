import { Loader } from "@/components/motion/loader";

export default function FormationLoading() {
  return (
    <main id="contenu" tabIndex={-1} className="py-8" aria-busy="true">
      <h1 className="sr-only">Chargement de la fiche formation</h1>
      <div
        aria-hidden="true"
        className="h-8 w-64 max-w-full rounded-lg bg-subtle"
      />
      <div
        aria-hidden="true"
        className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-32 rounded-xl bg-subtle" />
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2.5 text-xs text-muted-foreground">
        <Loader size={14} label="Chargement de la fiche…" />
        <span aria-hidden="true">Chargement de la fiche…</span>
      </div>
    </main>
  );
}
