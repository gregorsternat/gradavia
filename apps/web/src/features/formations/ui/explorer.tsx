import Form from "next/form";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  PAGE_SIZE,
  FILTER_KEYS,
  datasetUrl,
  explorerUrl,
  type ExplorerData,
  type FilterKey,
  type ExplorerResult,
} from "../domain/explorer";

const labels: Record<FilterKey, string> = {
  type: "Type de formation",
  region: "Région",
  departement: "Département",
  statut: "Statut de l’établissement",
  selectivite: "Sélectivité",
};
const control =
  "w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm disabled:opacity-60";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-85";
const secondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-subtle";
const count = (n: number) => n.toLocaleString("fr-FR");
const date = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(value));

function Header() {
  return (
    <div className="mb-9">
      <p className="mb-4 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        L’observatoire / Parcoursup
      </p>
      <h1 className="text-4xl leading-tight font-medium tracking-[-0.055em] sm:text-5xl">
        Explorer les formations
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        Une formation, un établissement, un territoire. Retrouvez les formations
        présentes dans les campagnes d’admission Parcoursup.
      </p>
    </div>
  );
}

function Filters({ data }: { data: ExplorerData }) {
  const active = FILTER_KEYS.filter((key) => data.query[key]).length;
  return (
    <details className="formation-filters rounded-xl border border-border p-5 lg:border-0 lg:p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium lg:pointer-events-none">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filtres
          {active ? ` (${active})` : ""}
        </span>
        <ArrowDown className="size-4 lg:hidden" aria-hidden="true" />
      </summary>
      <div className="mt-6 space-y-5">
        {FILTER_KEYS.map((key) => {
          const disabled =
            key === "statut"
              ? !data.source.fields.includes("contrat_etab")
              : key === "selectivite"
                ? !data.source.fields.includes("select_form")
                : false;
          const options = data.facets[key];
          return (
            <div key={key}>
              <label
                className="mb-2 block text-xs font-medium"
                htmlFor={`filter-${key}`}
              >
                {labels[key]}
              </label>
              <select
                id={`filter-${key}`}
                name={key}
                defaultValue={data.query[key]}
                disabled={disabled}
                className={control}
                aria-describedby={disabled ? `${key}-unavailable` : undefined}
              >
                <option value="">Tous</option>
                {data.query[key] && !options.includes(data.query[key]) && (
                  <option value={data.query[key]}>{data.query[key]}</option>
                )}
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {disabled && (
                <p
                  id={`${key}-unavailable`}
                  className="mt-2 text-xs leading-5 text-muted-foreground"
                >
                  Non publié pour cette campagne.
                </p>
              )}
            </div>
          );
        })}
        <button className={`${primary} w-full`} type="submit">
          Appliquer les filtres
        </button>
        <Link
          className="block text-center text-xs text-muted-foreground underline underline-offset-4"
          href={`/formations?campagne=${data.source.campaign}`}
        >
          Réinitialiser la recherche
        </Link>
      </div>
    </details>
  );
}

function Results({ data }: { data: ExplorerData }) {
  const { total, query } = data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <section aria-label="Résultats de la recherche" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 text-xs text-muted-foreground">
        <p role="status">
          <span className="text-sm font-medium text-foreground">
            {count(total)} résultat{total === 1 ? "" : "s"}
          </span>
          {total > 0 && (
            <span className="ml-2">
              · {count((query.page - 1) * PAGE_SIZE + 1)}–
              {count(Math.min(query.page * PAGE_SIZE, total))}
            </span>
          )}
        </p>
        <p>Par intitulé · A–Z</p>
      </div>
      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <h2 className="text-lg font-medium">
            Aucune formation ne correspond à votre recherche.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Essayez un autre intitulé ou élargissez vos filtres.
          </p>
          <Link
            href={`/formations?campagne=${data.source.campaign}`}
            className={`${secondary} mt-6`}
          >
            Effacer les filtres
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data.formations.map((formation) => (
            <li key={formation.id} className="py-6 first:pt-4">
              <article>
                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formation.type ?? "Type non renseigné"}
                  </span>
                  <span>
                    {formation.selectivity ?? "Sélectivité non publiée"}
                  </span>
                </div>
                <h2 className="text-lg leading-7 font-medium tracking-tight break-words sm:text-xl">
                  {formation.title}
                </h2>
                <p className="mt-2 text-sm leading-6">
                  {formation.establishment ?? "Établissement non renseigné"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {[
                    formation.city ?? "Ville non renseignée",
                    formation.department,
                    formation.region,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {formation.status ?? "Statut non publié"}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                    <a
                      href={datasetUrl(data.source.datasetId)}
                      className="underline decoration-border underline-offset-4 hover:decoration-current"
                      aria-label={`Source des données : ${formation.title}`}
                    >
                      Source des données
                    </a>
                    {formation.parcoursupUrl ? (
                      <a
                        href={formation.parcoursupUrl}
                        className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                        aria-label={`Fiche Parcoursup : ${formation.title}`}
                      >
                        Fiche Parcoursup{" "}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        Lien Parcoursup indisponible
                      </span>
                    )}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav
          aria-label="Pagination des formations"
          className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-6"
        >
          {query.page > 1 ? (
            <Link
              className={secondary}
              href={explorerUrl(query, query.page - 1)}
              rel="prev"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Précédente</span>
              <span className="sr-only sm:hidden">Page précédente</span>
            </Link>
          ) : (
            <span />
          )}
          <p className="text-xs text-muted-foreground">
            Page {query.page} sur {pages}
          </p>
          {query.page < pages ? (
            <Link
              className={secondary}
              href={explorerUrl(query, query.page + 1)}
              rel="next"
            >
              <span className="hidden sm:inline">Suivante</span>
              <span className="sr-only sm:hidden">Page suivante</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}

export function FormationExplorer({
  result,
  retryUrl = "/formations",
}: {
  result: ExplorerResult;
  retryUrl?: string;
}) {
  if (result.status !== "ready")
    return (
      <main id="contenu" className="flex-1 py-10 sm:py-14">
        <Header />
        <section className="rounded-xl border border-border bg-surface p-8 sm:py-14">
          <h2 className="text-xl font-medium">
            {result.status === "empty"
              ? "Aucune campagne n’est disponible pour le moment."
              : "Les formations sont temporairement indisponibles."}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {result.status === "empty"
              ? "Les formations seront accessibles dès la publication d’une campagne de données."
              : "La connexion aux données n’a pas pu aboutir. Vous pouvez réessayer dans un instant."}
          </p>
          <a href={retryUrl} className={`${secondary} mt-6`}>
            Réessayer
          </a>
        </section>
      </main>
    );
  const { data } = result;
  return (
    <main id="contenu" className="flex-1 py-10 sm:py-14">
      <Header />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5 rounded-xl border border-border bg-surface p-5">
        <Form
          action="/formations"
          className="flex flex-wrap items-end gap-3"
          key={data.source.campaign}
        >
          <div>
            <label
              className="mb-2 block text-xs font-medium"
              htmlFor="campaign"
            >
              Campagne d’admission
            </label>
            <select
              id="campaign"
              name="campagne"
              defaultValue={data.source.campaign}
              className={`${control} min-w-28`}
            >
              {data.campaigns.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={secondary}>
            Afficher
          </button>
        </Form>
        <p className="max-w-xs text-xs leading-5 text-muted-foreground">
          Données historiques · Hors apprentissage
          <br />
          Une campagne à la fois, dans son contexte.
        </p>
      </div>
      {data.notices.map((notice) => (
        <p
          key={notice}
          className="mb-5 text-sm text-muted-foreground"
          role="status"
        >
          {notice}
        </p>
      ))}
      <Form action="/formations" key={explorerUrl(data.query, data.query.page)}>
        <input type="hidden" name="campagne" value={data.source.campaign} />
        <div className="mb-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="formation-search" className="sr-only">
              Rechercher une formation, un établissement ou une ville
            </label>
            <Search
              className="pointer-events-none absolute top-3.5 left-4 size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="formation-search"
              type="search"
              name="q"
              maxLength={120}
              defaultValue={data.query.q}
              placeholder="Formation, établissement, ville…"
              className={`${control} min-h-12 pl-12`}
            />
          </div>
          <button type="submit" className={primary}>
            Rechercher <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <Filters data={data} />
          <Results data={data} />
        </div>
      </Form>
      <section
        aria-label="Sources et périmètre"
        className="mt-12 border-t border-border pt-6 text-xs leading-6 text-muted-foreground"
      >
        <h2 className="mb-2 text-sm font-medium text-foreground">
          Des données, avec leur contexte
        </h2>
        <p>
          Campagne {data.source.campaign} · Formations hors apprentissage ·{" "}
          {data.source.provider}
        </p>
        <p>
          Collecte du {date(data.source.collectedAt)} · Mise à jour source :{" "}
          {data.source.modifiedAt
            ? date(data.source.modifiedAt)
            : "non renseignée"}{" "}
          · {data.source.license}
        </p>
        <p>
          Les informations non publiées restent signalées. Les liens Parcoursup
          historiques peuvent mener à une fiche actuelle ou ne plus être
          disponibles.
        </p>
        <a
          href={datasetUrl(data.source.datasetId)}
          className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
        >
          Consulter le jeu de données source{" "}
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}
