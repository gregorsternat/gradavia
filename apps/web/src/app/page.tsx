import Link from "next/link";

export default function Home() {
  return (
    <main
      id="contenu"
      className="flex flex-1 flex-col justify-center py-20 sm:py-28"
    >
      <div className="mb-9 inline-flex w-fit items-center gap-2.5 rounded-full border border-border px-3.5 py-2 text-xs text-muted-foreground">
        <span
          className="size-1.5 rounded-full bg-foreground"
          aria-hidden="true"
        />
        Les campagnes Parcoursup à explorer
      </div>
      <p className="mb-5 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        Les données de l’orientation, autrement
      </p>
      <h1 className="max-w-4xl text-[clamp(2.8rem,7vw,5.8rem)] leading-[1.04] font-medium tracking-[-0.065em]">
        Plus de clarté.
        <br />
        <span className="text-muted-foreground">Plus de perspectives.</span>
      </h1>
      <p className="mt-8 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
        Les données publiques peuvent éclairer nos choix. Retrouvez les
        formations Parcoursup, leurs établissements et leurs territoires,
        campagne par campagne.
      </p>
      <Link
        href="/formations"
        className="mt-8 inline-flex w-fit items-center gap-4 rounded-full bg-foreground px-6 py-3.5 text-sm font-medium text-background hover:opacity-85"
      >
        Explorer les formations <span aria-hidden="true">→</span>
      </Link>
      <div className="mt-16 grid gap-6 border-t border-border pt-7 sm:mt-20 sm:grid-cols-[1fr_2fr]">
        <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          Premier terrain d’exploration
        </p>
        <div>
          <h2 className="text-lg font-medium tracking-tight">Parcoursup</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Formations, candidatures et admissions. Une lecture des chiffres qui
            garde leurs sources et leur contexte.
          </p>
        </div>
      </div>
      {process.env.NODE_ENV === "development" && (
        <Link
          href="/dev/ui"
          className="mt-8 w-fit text-xs text-muted-foreground underline underline-offset-4"
        >
          Galerie des composants
        </Link>
      )}
    </main>
  );
}
