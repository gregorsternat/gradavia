import { Loader } from "@/components/motion/loader";

export default function LoadingFormations() {
  return (
    <main id="contenu" tabIndex={-1} className="flex-1 py-14" aria-busy="true">
      <h1 className="text-4xl font-medium tracking-tight">
        Explorer les formations
      </h1>
      <div className="mt-6 flex items-center gap-2.5 text-xs text-muted-foreground">
        <Loader
          size={14}
          label="Chargement des formations…"
          className="text-muted-foreground"
        />
        <span aria-hidden="true">Chargement des formations…</span>
      </div>
      <div aria-hidden="true" className="mt-10 space-y-5">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className="h-36 rounded-xl border border-border bg-subtle"
          />
        ))}
      </div>
    </main>
  );
}
