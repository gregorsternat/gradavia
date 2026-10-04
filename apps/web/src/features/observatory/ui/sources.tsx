"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Database,
  FileCheck2,
  Fingerprint,
  Info,
  Layers3,
  ScanEye,
  ShieldCheck,
} from "lucide-react";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Tooltip } from "@/components/motion/tooltip";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { number, type SourcesResult } from "../domain/overview";

const sourceFamilies: Record<string, string> = {
  apb: "APB",
  parcoursup: "Parcoursup",
  apprenticeship: "Apprentissage",
  formation_map: "Cartographie",
  specialties: "Spécialités du bac",
};

const definitions = [
  {
    id: "access",
    title: "Taux d’accès",
    description:
      "Indicateur officiel publié par le ministère (taux_acces_ens), fondé sur le rang du dernier candidat appelé en phase principale. Il ne se calcule pas en divisant les admis par les candidatures et ne représente pas votre probabilité personnelle d’admission.",
  },
  {
    id: "applications",
    title: "Candidatures",
    description:
      "Candidats ayant déposé un vœu pour une formation, toutes phases confondues (voe_tot). Une même personne peut figurer dans plusieurs formations : une somme de candidatures n’est pas un nombre de personnes uniques.",
  },
  {
    id: "capacity",
    title: "Places proposées",
    description:
      "Capacité d’accueil publiée pour la formation (capa_fin). Les totaux de l’observatoire additionnent uniquement les capacités renseignées. Une capacité et un nombre d’admis peuvent différer.",
  },
  {
    id: "admitted",
    title: "Propositions et admis",
    description:
      "Les propositions correspondent aux candidats ayant reçu une proposition d’admission (prop_tot). Les admis sont ceux qui en ont accepté une (acc_tot), en phases principale et complémentaire. Ces valeurs ne décrivent pas l’inscription administrative finale.",
  },
  {
    id: "profiles",
    title: "Profil des admis",
    description:
      "La part de femmes (pct_f) porte sur l’ensemble des admis. Les parts de boursiers et de séries de bac portent sur les néo-bacheliers admis. Ces populations sont différentes : leurs pourcentages ne se combinent pas et ne couvrent pas nécessairement tous les profils.",
  },
  {
    id: "missing",
    title: "Valeurs absentes, masquées ou invalides",
    description:
      "Un zéro publié est un zéro. Un champ absent reste non disponible. Une valeur masquée par le producteur reste masquée. Une représentation invalide est signalée sans être convertie en chiffre. Les sommes partielles indiquent le nombre de lignes renseignées.",
  },
  {
    id: "continuity",
    title: "Évolutions et changements de périmètre",
    description:
      "Les identifiants de formation et d’établissement servent à retrouver les observations historiques. Ils ne prouvent pas qu’une formation est restée identique. Un changement de libellé, un doublon ou une absence sont signalés. Les courbes nationales reflètent aussi les changements de couverture de la source.",
  },
  {
    id: "apb",
    title: "Pourquoi APB est séparé de Parcoursup",
    description:
      "APB utilisait des vœux hiérarchisés et des règles différentes. Les populations, phases et identifiants ne sont pas directement équivalents. Les archives APB sont conservées, mais Gradavia ne trace pas de courbe continue entre APB et Parcoursup.",
  },
];
export function Sources({ result }: { result: SourcesResult }) {
  return (
    <main id="contenu" tabIndex={-1} className="py-6 sm:py-8">
      <div className="mb-9">
        <h1 className="page-title">Données & méthode</h1>
        <p className="page-subtitle">
          Sources publiques, définitions et périmètre de l’observatoire.
        </p>
        <ButtonLink
          href="/donnees"
          variant="secondary"
          size="sm"
          className="mt-4"
        >
          API publique et notebooks
        </ButtonLink>
      </div>
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        {[
          {
            Icon: Database,
            title: "À la source",
            text: "Données ouvertes du ministère chargé de l’Enseignement supérieur.",
          },
          {
            Icon: Fingerprint,
            title: "Chaque version conservée",
            text: "Une collecte datée et une version identifiable pour retrouver les chiffres.",
          },
          {
            Icon: ScanEye,
            title: "Sans estimation cachée",
            text: "Les absences et les valeurs masquées restent visibles.",
          },
        ].map(({ Icon, title, text }) => (
          <div key={title} className="rounded-xl bg-sidebar p-5">
            <Icon
              className="mb-4 size-5 text-muted-foreground"
              strokeWidth={1.5}
            />
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {text}
            </p>
          </div>
        ))}
      </div>
      <section aria-labelledby="sources-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="sources-title"
            className="text-lg font-semibold tracking-tight"
          >
            Les jeux de données
          </h2>
          {result.status === "ready" && (
            <span className="text-xs text-muted-foreground">
              {result.data.totals.published} jeux importés sur{" "}
              {result.data.totals.datasets}
            </span>
          )}
        </div>
        {result.status === "unavailable" ? (
          <div className="panel p-6 text-sm text-muted-foreground">
            L’inventaire des imports est momentanément indisponible.{" "}
            <a
              className="underline"
              href="https://data.enseignementsup-recherche.gouv.fr/explore/?q=parcoursup"
            >
              Consulter le catalogue ministériel
            </a>
            .
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {result.data.datasets.map((source) => (
                <article
                  className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  key={source.datasetId}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>
                        {sourceFamilies[source.family] ?? "Autre source"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {source.campaigns.length
                          ? source.campaigns.join(", ")
                          : "Campagne non disponible"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-medium leading-6">
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {source.title}
                        <ArrowUpRight className="ml-1 inline size-3" />
                      </a>
                    </h3>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {source.provider}
                      {source.collectedAt
                        ? ` · Collecté le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(source.collectedAt))}`
                        : ""}
                      {source.license ? ` · ${source.license}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {source.rowCount === null
                          ? "—"
                          : number(source.rowCount)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        lignes source
                      </p>
                    </div>
                    <Tooltip
                      content={
                        source.status === "published"
                          ? "Version importée et publiée"
                          : "Source répertoriée, pas encore importée"
                      }
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={
                          source.status === "published"
                            ? "Import publié"
                            : "Pas encore importé"
                        }
                      >
                        {source.status === "published" ? (
                          <FileCheck2 className="size-4" />
                        ) : (
                          <Info className="size-4" />
                        )}
                      </Button>
                    </Tooltip>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              Les catalogues, admissions et agrégats de spécialités ont des
              unités différentes. Leurs lignes ne s’additionnent pas en un
              nombre de formations.
            </p>
          </>
        )}
      </section>
      <section id="indicateurs" className="mt-12 max-w-4xl">
        <h2 className="mb-5 text-lg font-semibold tracking-tight">
          Comprendre les indicateurs
        </h2>
        <BouncyAccordion
          items={definitions}
          classNames={{
            title: "text-sm font-medium",
            description: "text-sm leading-7 text-muted-foreground",
            trigger: "py-5",
            item: "shadow-none",
          }}
        />
      </section>
      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl bg-sidebar p-5">
          <ShieldCheck className="mb-3 size-5 text-muted-foreground" />
          <h2 className="text-sm font-medium">Vos favoris restent chez vous</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            La sélection est enregistrée dans ce navigateur, sans compte.
            Effacer les données du navigateur supprime vos favoris.
          </p>
        </div>
        <div className="rounded-xl bg-sidebar p-5">
          <Layers3 className="mb-3 size-5 text-muted-foreground" />
          <h2 className="text-sm font-medium">
            Comparer dans le même contexte
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Le comparateur rapproche des formations d’une même campagne. Leurs
            populations et leur sélectivité peuvent différer.
          </p>
          <Link
            href="/comparer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium"
          >
            Ouvrir le comparateur <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </section>
    </main>
  );
}
