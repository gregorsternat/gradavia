import { Loader } from "@/components/motion/loader";

export default function ObservatoryLoading() {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="py-8"
      aria-busy="true"
      aria-label="Chargement de l’observatoire"
    >
      <div aria-hidden="true" className="h-8 w-56 rounded-lg bg-subtle" />
      <div
        aria-hidden="true"
        className="mt-4 h-4 w-72 max-w-full rounded bg-subtle"
      />
      <div
        aria-hidden="true"
        className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-sidebar" />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]"
      >
        <div className="panel h-80 bg-sidebar" />
        <div className="panel h-80 bg-sidebar" />
      </div>
      <div className="mt-6 flex items-center gap-2.5 text-xs text-muted-foreground">
        <Loader
          size={14}
          label="Chargement des données…"
          className="text-muted-foreground"
        />
        <span aria-hidden="true">Chargement des données…</span>
      </div>
    </main>
  );
}
