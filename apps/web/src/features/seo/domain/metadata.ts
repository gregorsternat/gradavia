import type { Metadata } from "next";
import type { SearchParams } from "../../formations/domain/explorer";
import { explorerUrl, FILTER_KEYS } from "../../formations/domain/explorer";
import type { ExplorerResult } from "../../formations/domain/api-contract";

export const SITE_URL = "https://gradavia.com";
export const SITE_NAME = "Gradavia";

export const pages = {
  "/": {
    title: "Formations Parcoursup : statistiques et comparateur",
    description:
      "Explorez les formations Parcoursup, leurs taux d’accès, places et admissions. Comparez les établissements avec les données publiques et leurs sources sur Gradavia.",
  },
  "/formations": {
    title: "Formations Parcoursup : recherche et taux d’accès",
    description:
      "Recherchez une formation Parcoursup par ville, région ou filière. Consultez les places, candidatures, admissions et taux d’accès de chaque campagne publiée.",
  },
  "/observatoire": {
    title: "Statistiques Parcoursup : places, vœux et admissions",
    description:
      "Consultez les statistiques nationales de Parcoursup par campagne : formations, places proposées, candidatures et admissions, avec la couverture des données.",
  },
  "/territoires": {
    title: "Parcoursup par région : formations et admissions",
    description:
      "Explorez l’offre de formation et les admissions Parcoursup par région. Comparez les territoires en conservant la campagne et le périmètre des données publiques.",
  },
  "/carte": {
    title: "Carte des formations Parcoursup en France",
    description:
      "Repérez les formations Parcoursup sur une carte, filtrez par territoire et consultez leurs indicateurs. Les coordonnées et leur couverture proviennent des sources.",
  },
  "/apprentissage": {
    title: "Formations en apprentissage sur Parcoursup",
    description:
      "Explorez les formations en apprentissage : places, candidatures et propositions publiées sur Parcoursup. Des indicateurs distincts des formations hors apprentissage.",
  },
  "/archives": {
    title: "Archives APB : vœux et admissions Admission Post-Bac",
    description:
      "Consultez les données historiques d’Admission Post-Bac par formation et campagne. Les archives APB restent séparées de Parcoursup, avec leurs propres définitions.",
  },
  "/specialites": {
    title: "Spécialités du bac : quelles formations sur Parcoursup ?",
    description:
      "Découvrez les destinations Parcoursup des bacheliers généraux selon leur doublette de spécialités. Données publiques 2025, effectifs et limites de comparaison.",
  },
  "/specialites/inverse": {
    title: "Quelles spécialités du bac parmi les admis d’une formation ?",
    description:
      "Explorez les doublettes de spécialités des bacheliers généraux selon les formations Parcoursup. Des observations publiées, sans prédiction individuelle d’admission.",
  },
  "/evolutions": {
    title: "Évolution des formations et admissions par campagne",
    description:
      "Comparez deux campagnes d’une même source : places, candidatures et admissions. Les correspondances entre formations et les données manquantes restent explicites.",
  },
  "/sources": {
    title: "Données Parcoursup et APB : sources et méthode",
    description:
      "Comprenez les sources de Gradavia, la définition du taux d’accès Parcoursup, les campagnes disponibles et les limites des comparaisons entre formations.",
  },
  "/donnees": {
    title: "Données ouvertes Parcoursup et APB : API et exports",
    description:
      "Réutilisez les données publiques de Parcoursup, de l’apprentissage et d’APB : exports CSV et JSON, API, notebooks, versions et définitions des indicateurs.",
  },
  "/budget": {
    title: "Calculateur de budget étudiant : vos scénarios",
    description:
      "Préparez votre budget étudiant avec vos propres montants de logement, transport et dépenses. Comparez des scénarios enregistrés dans votre navigateur.",
  },
  "/comparer": {
    title: "Comparer les formations Parcoursup",
    description:
      "Comparez jusqu’à quatre formations d’une même campagne Parcoursup : capacités, candidatures, admissions et taux d’accès, avec leurs sources.",
    noIndex: true,
  },
  "/favoris": {
    title: "Mes favoris et listes de formations",
    description:
      "Retrouvez les formations et listes que vous avez enregistrées dans ce navigateur pour préparer votre orientation.",
    noIndex: true,
  },
  "/analyses": {
    title: "Atelier d’analyse des données Parcoursup",
    description:
      "Explorez les données publiques avec vos filtres, tableaux et graphiques. Exportez une analyse avec sa campagne, sa version et ses définitions.",
    noIndex: true,
  },
  "/modalites": {
    title: "Comparer formation classique et apprentissage",
    description:
      "Consultez côte à côte les observations de deux formations, en conservant les définitions propres à Parcoursup et à l’apprentissage.",
    noIndex: true,
  },
  "/decouvrir": {
    title: "Découvrir les données Parcoursup en questions",
    description:
      "Testez vos intuitions sur les formations et les admissions avec des questions tirées des données publiques de Parcoursup.",
    noIndex: true,
  },
} satisfies Record<
  string,
  { title: string; description: string; noIndex?: boolean }
>;

export type PublicPage = keyof typeof pages;
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href;

export function createMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const socialTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: !noIndex,
      follow: true,
      ...(!noIndex && {
        googleBot: { index: true, follow: true, "max-image-preview": "large" },
      }),
    },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      url,
      images: [
        {
          url: absoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: "Gradavia — Les données publiques pour éclairer votre orientation",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [absoluteUrl("/opengraph-image")],
    },
  };
}

/** Presentation and campaign tracking do not create another document. */
export function contentQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    if (/^(utm_|gclid$|fbclid$|msclkid$|vue$)/.test(key)) continue;
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) query.set(key.slice(0, 80), value.slice(0, 160));
  }
  return query.toString();
}

export function pageMetadata(
  path: PublicPage,
  params: SearchParams = {},
): Metadata {
  const page = pages[path];
  const personal = "noIndex" in page && page.noIndex;
  const query = path === "/" || personal ? "" : contentQuery(params);
  return createMetadata({
    ...page,
    path: `${path}${query ? `?${query}` : ""}`,
    noIndex: personal || Boolean(query),
  });
}

/** Use the API's resolved campaign and clamped page, not unchecked URL input. */
export function explorerMetadata(result: ExplorerResult): Metadata {
  if (result.status !== "ready")
    return createMetadata({
      ...pages["/formations"],
      path: "/formations",
      noIndex: true,
    });
  const { query, source, campaigns, total } = result.data;
  const canonicalQuery = {
    ...query,
    campagne:
      source.campaign === Math.max(...campaigns) ? null : source.campaign,
  };
  return createMetadata({
    title: `Formations Parcoursup ${source.campaign}${query.page > 1 ? ` — page ${query.page}` : ""} : recherche et taux d’accès`,
    description: pages["/formations"].description,
    path: explorerUrl(canonicalQuery, query.page),
    noIndex:
      total === 0 ||
      Boolean(query.q) ||
      FILTER_KEYS.some((key) => Boolean(query[key])) ||
      query.tri !== "nom",
  });
}
