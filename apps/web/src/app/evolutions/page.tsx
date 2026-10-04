import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { loadAtlas } from "@/features/atlas/server/load";
import { Evolution } from "@/features/evolution/ui/evolution";
import { prepareEvolution } from "@/features/evolution/domain/evolution";
import { ButtonLink } from "@/components/motion/button/base";

export const metadata: Metadata = { title: "Évolutions" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const value = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const after = await loadAtlas({
    famille: value("famille"),
    campagne: value("fin"),
    version: value("version_fin"),
  });
  const priorYear =
    after.status === "ready"
      ? [...after.data.campaigns]
          .filter((year) => year < after.data.source.campaign)
          .sort((a, b) => b - a)[0]
      : undefined;
  const firstYear =
    value("debut") ?? (priorYear === undefined ? undefined : String(priorYear));
  const before =
    after.status === "ready" && firstYear
      ? await loadAtlas({
          famille: after.data.family,
          campagne: firstYear,
          version: value("version_debut"),
        })
      : null;
  if (
    after.status !== "ready" ||
    before?.status !== "ready" ||
    before.data.source.campaign === after.data.source.campaign
  )
    return (
      <main id="contenu" tabIndex={-1} className="py-8">
        <h1 className="page-title">Évolutions</h1>
        <div className="panel mt-8 space-y-5 p-8">
          <h2 className="text-lg font-medium">
            {after.status === "unavailable" || before?.status === "unavailable"
              ? "Les données sont temporairement indisponibles"
              : "Deux campagnes distinctes sont nécessaires"}
          </h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            La comparaison utilise deux publications de la même famille. Une
            version demandée indisponible n’est jamais remplacée
            automatiquement.
          </p>
          <div className="flex flex-wrap gap-2">
            {["parcoursup", "apprentissage", "apb"].map((family) => (
              <ButtonLink
                key={family}
                href={`/evolutions?famille=${family}`}
                variant="secondary"
                size="sm"
              >
                {family === "apb"
                  ? "Archives APB"
                  : family === "parcoursup"
                    ? "Parcoursup"
                    : "Apprentissage"}
              </ButtonLink>
            ))}
            <ButtonLink href="/analyses" variant="ghost" size="sm">
              Ouvrir l’atelier
            </ButtonLink>
          </div>
        </div>
      </main>
    );
  return (
    <Evolution
      key={`${before.data.source.releaseId}:${before.data.source.campaign}:${after.data.source.releaseId}:${after.data.source.campaign}`}
      data={prepareEvolution(before.data, after.data)}
    />
  );
}
