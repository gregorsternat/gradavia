"use client";
import { PanelMain } from "@/features/workspace/ui/navigation";
import Link from "@/features/workspace/ui/navigation";
import { ArrowDownToLine, ArrowUpRight, Braces, FileCode2 } from "lucide-react";
import { ButtonLink } from "@/components/motion/button/base";
import type { SourcesResult } from "@/features/observatory/domain/overview";

const families = [
  {
    key: "parcoursup",
    registry: "parcoursup",
    title: "Parcoursup",
    description:
      "Formations hors apprentissage, capacités, candidatures et admissions.",
  },
  {
    key: "apprentissage",
    registry: "apprenticeship",
    title: "Apprentissage",
    description:
      "Capacités, candidatures et propositions du jeu dédié à l’apprentissage.",
  },
  {
    key: "apb",
    registry: "apb",
    title: "Archives APB",
    description:
      "Campagnes 2016–2017, avec leurs champs et leur périmètre d’origine.",
  },
];
export function DataAccess({ result }: { result: SourcesResult }) {
  return (
    <PanelMain id="contenu" tabIndex={-1} className="py-6 sm:py-8">
      <header className="mb-9">
        <h1 className="page-title">Réutiliser les données</h1>
        <p className="page-subtitle">
          Exports ouverts, API et exemples reproductibles.
        </p>
      </header>
      <section
        aria-label="Jeux disponibles"
        className="grid gap-4 lg:grid-cols-3"
      >
        {families.map((family) => {
          const source =
            result.status === "ready"
              ? result.data.datasets
                  .filter(
                    (d) =>
                      d.family === family.registry && d.status === "published",
                  )
                  .sort(
                    (a, b) =>
                      Math.max(...b.campaigns) - Math.max(...a.campaigns) ||
                      Number(a.datasetId === "fr-esr-parcoursup") -
                        Number(b.datasetId === "fr-esr-parcoursup"),
                  )[0]
              : undefined;
          const campaign = source ? Math.max(...source.campaigns) : null;
          const params = new URLSearchParams({ famille: family.key });
          if (source?.releaseId && campaign) {
            params.set("campagne", String(campaign));
            params.set("version", source.releaseId);
          }
          const endpoint = `/api/v1/datasets?${params}`;
          return (
            <article key={family.key} className="panel flex flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">{family.title}</h2>
                {campaign && (
                  <span className="text-xs tabular-nums text-muted">
                    {campaign}
                  </span>
                )}
              </div>
              <p className="mt-3 grow text-sm leading-relaxed text-muted">
                {family.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink
                  href={`${endpoint}&format=json`}
                  size="sm"
                  variant="secondary"
                >
                  <Braces className="size-3.5" aria-hidden="true" />
                  JSON
                </ButtonLink>
                <ButtonLink
                  href={`${endpoint}&format=csv`}
                  size="sm"
                  variant="secondary"
                >
                  <ArrowDownToLine className="size-3.5" aria-hidden="true" />
                  CSV
                </ButtonLink>
              </div>
              <a
                href={`${endpoint}&format=metadata`}
                className="mt-4 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
              >
                Définitions et version
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
              {!source && (
                <p className="mt-3 text-xs text-muted">
                  Disponibilité à vérifier dans l’API.
                </p>
              )}
            </article>
          );
        })}
      </section>
      <section className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <h2 className="text-lg font-medium tracking-tight">API publique</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Lecture sans compte ni clé. Chaque réponse contient la version
            source, les définitions et la couverture des indicateurs.
          </p>
          <a
            href="/api/v1/datasets?famille=parcoursup"
            className="mt-5 block break-all rounded-lg bg-subtle px-4 py-3 font-mono text-xs hover:underline"
          >
            GET /api/v1/datasets?famille=parcoursup
          </a>
          <dl className="mt-6 space-y-5 text-sm">
            {[
              [
                "famille",
                "parcoursup, apprentissage ou apb. Parcoursup par défaut.",
              ],
              [
                "campagne",
                "Année sur quatre chiffres. La plus récente disponible par défaut.",
              ],
              [
                "version",
                "Identifiant de publication reçu dans source.releaseId. Conserve exactement cet instantané, même après une mise à jour.",
              ],
              [
                "format",
                "json par défaut ; csv pour les lignes et leurs états ; metadata pour les définitions, la provenance et les liens.",
              ],
            ].map(([name, detail]) => (
              <div key={name} className="grid grid-cols-[5rem_1fr] gap-4">
                <dt className="font-mono text-xs">{name}</dt>
                <dd className="text-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            Commencer une analyse
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Les exemples enregistrent la version téléchargée, vérifient les
            états des valeurs et conservent les sources.
          </p>
          <div className="mt-5 flex flex-col items-start gap-3">
            <ButtonLink
              href="/notebooks/gradavia.ipynb"
              download
              size="sm"
              variant="secondary"
            >
              <FileCode2 className="size-4" aria-hidden="true" />
              Notebook Python
            </ButtonLink>
            <ButtonLink
              href="/notebooks/gradavia.R"
              download
              size="sm"
              variant="secondary"
            >
              <FileCode2 className="size-4" aria-hidden="true" />
              Script R
            </ButtonLink>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Python 3, bibliothèque standard. R nécessite jsonlite.
          </p>
          <div className="mt-8 space-y-3 text-sm leading-relaxed text-muted">
            <h3 className="font-medium text-foreground">Lire les valeurs</h3>
            <p>
              Un zéro observé reste zéro. Une valeur absente, masquée ou
              invalide est null en JSON, avec son état dans states. Le CSV
              ajoute une colonne d’état à chaque indicateur.
            </p>
            <p>
              Les candidatures cumulées ne comptent pas des personnes uniques.
              Les pourcentages ont des dénominateurs différents ; le taux
              d’accès n’est pas une probabilité individuelle.
            </p>
            <Link
              href="/sources"
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              Consulter la méthode
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="mt-10 max-w-3xl text-sm leading-relaxed text-muted">
        <h2 className="font-medium text-foreground">Périmètre et réponses</h2>
        <p className="mt-3">
          Une requête porte sur une famille, une campagne et une version,
          jusqu’à 30 000 lignes. Au-delà, l’API échoue explicitement. Les
          versions demandées ne sont jamais remplacées par une publication plus
          récente.
        </p>
        <p className="mt-3">
          200 : données ou jeu encore vide. 400 : paramètre invalide. 404 :
          campagne ou version introuvable. 503 : service indisponible ou limite
          dépassée. Les réponses d’erreur ne sont pas mises en cache.
        </p>
      </section>
    </PanelMain>
  );
}
