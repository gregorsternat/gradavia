export default function LoadingFormations() {
  return (
    <main id="contenu" className="flex-1 py-14" aria-busy="true">
      <h1 className="text-4xl font-medium tracking-tight">
        Explorer les formations
      </h1>
      <p role="status" className="mt-6 text-sm text-muted-foreground">
        Chargement des formations…
      </p>
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
