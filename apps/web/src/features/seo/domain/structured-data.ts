import type { AtlasFamily, AtlasItem } from "../../atlas/domain/api-contract";
import { familyLabels } from "../../atlas/domain/exploration";
import type { CampaignSource } from "../../formations/domain/api-contract";
import { formationUrl } from "../../formations/domain/metrics";
import { absoluteUrl, createMetadata, pages } from "./metadata";

type FormationIdentity = Pick<
  AtlasItem,
  "id" | "title" | "establishment" | "city" | "department" | "region"
>;
export type Breadcrumb = { name: string; path: string };

export function detailPath(id: string, family: AtlasFamily): string {
  return family === "parcoursup"
    ? formationUrl(id)
    : `/atlas/${encodeURIComponent(id)}`;
}

export function detailIdentity(
  row: FormationIdentity,
  source: CampaignSource,
  family: AtlasFamily,
) {
  const location = row.city ?? row.department ?? row.region;
  const establishment = [row.establishment, location]
    .filter(Boolean)
    .join(", ");
  return {
    title: `${row.title}${establishment ? ` — ${establishment}` : ""} · ${familyLabels[family]} ${source.campaign}`,
    description: `${row.title}${establishment ? ` à ${establishment}` : ""}. Consultez les ${family === "parcoursup" ? "places, admissions et taux d’accès" : "indicateurs publiés"} de la campagne ${source.campaign}, avec les sources et les limites de comparaison.`,
    path: detailPath(row.id, family),
  };
}

export function detailMetadata(
  row: FormationIdentity,
  source: CampaignSource,
  family: AtlasFamily,
) {
  return createMetadata(detailIdentity(row, source, family));
}

export function detailBreadcrumbs(
  row: FormationIdentity,
  source: CampaignSource,
  family: AtlasFamily,
): Breadcrumb[] {
  const path =
    family === "parcoursup"
      ? "/formations"
      : family === "apprentissage"
        ? "/apprentissage"
        : "/archives";
  return [
    { name: "Accueil", path: "/" },
    {
      name: `${familyLabels[family]} ${source.campaign}`,
      path: `${path}?campagne=${source.campaign}`,
    },
    { name: row.title, path: detailPath(row.id, family) },
  ];
}

export function detailStructuredData(
  row: FormationIdentity,
  source: CampaignSource,
  family: AtlasFamily,
) {
  const identity = detailIdentity(row, source, family);
  const url = absoluteUrl(identity.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: identity.title,
        description: identity.description,
        inLanguage: "fr-FR",
        isPartOf: { "@id": absoluteUrl("/#website") },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: detailBreadcrumbs(row, source, family).map(
          (item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path),
          }),
        ),
      },
    ],
  };
}

export const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": absoluteUrl("/#website"),
  name: "Gradavia",
  url: absoluteUrl("/"),
  description: pages["/"].description,
  inLanguage: "fr-FR",
};

/** Source labels are untrusted text, including inside script elements. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
