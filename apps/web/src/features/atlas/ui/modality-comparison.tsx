"use client";
import { Input } from "@/components/motion/input";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Table } from "@/components/motion/table";
import { SourceDisclosure } from "@/features/formations/ui/shared";
import type { CampaignSource } from "@/features/formations/domain/api-contract";
import type { AtlasItem, AtlasMetricKey } from "../domain/api-contract";

export type ModalityChoice = {
  source: CampaignSource;
  selected: AtlasItem | null;
  candidates: AtlasItem[];
  total: number;
  q: string;
};
const fields = [
  "capacity",
  "applications",
  "offers",
  "admitted",
  "accessRate",
] as const;
const labels = {
  capacity: "Places proposées",
  applications: "Candidatures",
  offers: "Propositions",
  admitted: "Admis",
  accessRate: "Taux d’accès officiel",
};
function value(item: AtlasItem | null, key: AtlasMetricKey) {
  const number = item?.metrics[key];
  return number !== null && number !== undefined
    ? `${number.toLocaleString("fr-FR")}${key === "accessRate" ? " %" : ""}`
    : item?.states[key] === "suppressed"
      ? "Masqué"
      : item?.states[key] === "invalid"
        ? "Invalide"
        : "Non publié";
}
export function ModalityComparison({
  classic,
  apprentice,
  params,
}: {
  classic: ModalityChoice;
  apprentice: ModalityChoice;
  params: Record<string, string>;
}) {
  const href = (key: string, id: string) =>
    `/modalites?${new URLSearchParams({ ...params, [key]: id })}`;
  const rows = fields.map((key) => ({ key, label: labels[key] }));
  return (
    <main id="contenu" className="py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Comparer les modalités
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Formation hors apprentissage et apprentissage ont des procédures
        distinctes. Choisissez les deux formations ; aucun lien d’équivalence
        entre diplômes n’est présumé.
      </p>
      <form action="/modalites" method="get" className="my-7">
        <input type="hidden" name="classique" value={params.classique ?? ""} />
        <input type="hidden" name="apprenti" value={params.apprenti ?? ""} />
        <input
          type="hidden"
          name="campagne"
          value={String(classic.source.campaign)}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            {
              choice: classic,
              name: "q_classique",
              label: "Hors apprentissage",
            },
            { choice: apprentice, name: "q_apprenti", label: "Apprentissage" },
          ].map(({ choice, name, label }) => (
            <Input
              key={name}
              name={name}
              aria-label={`Rechercher une formation ${label.toLowerCase()}`}
              label={label}
              defaultValue={choice.q}
              placeholder="Intitulé ou ville"
              classNames={{ field: "rounded-lg", label: "text-xs" }}
            />
          ))}
        </div>
        <Button type="submit" size="sm" className="mt-4">
          Rechercher les formations
        </Button>
      </form>
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { choice: classic, field: "classique", label: "Hors apprentissage" },
          { choice: apprentice, field: "apprenti", label: "Apprentissage" },
        ].map(({ choice, field, label }) => (
          <section
            key={field}
            aria-label={label}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <h2 className="text-sm font-semibold">
              {label} · {choice.source.campaign}
            </h2>
            {choice.selected && (
              <div className="my-4 rounded-lg bg-subtle p-4">
                <h3 className="text-sm font-medium">{choice.selected.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  {choice.selected.establishment} · {choice.selected.city}
                </p>
              </div>
            )}
            <BouncyAccordion
              key={`${choice.selected?.id ?? "empty"}:${choice.q}`}
              defaultValue={choice.selected ? null : "candidates"}
              className="mt-4"
              classNames={{
                title: "text-xs font-medium",
                trigger: "px-0 py-2",
                description: "px-0 pb-2",
              }}
              items={[
                {
                  id: "candidates",
                  title: choice.selected
                    ? "Changer de formation"
                    : `${choice.total.toLocaleString("fr-FR")} résultats`,
                  description: (
                    <>
                      <p className="mb-3 mt-4 text-xs text-muted-foreground">
                        {choice.total.toLocaleString("fr-FR")} résultats
                        {choice.total > 8
                          ? " · 8 affichés, précisez la recherche"
                          : ""}
                      </p>
                      <div className="space-y-2">
                        {choice.candidates.map((row) => (
                          <ButtonLink
                            key={row.id}
                            href={href(field, row.id)}
                            variant="ghost"
                            className="h-auto w-full justify-start px-2 py-2 text-left"
                          >
                            <span>
                              <span className="block text-xs font-medium">
                                {row.title}
                              </span>
                              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                                {row.establishment} · {row.city ?? row.region}
                              </span>
                            </span>
                          </ButtonLink>
                        ))}
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </section>
        ))}
      </div>
      {classic.selected && apprentice.selected && (
        <section className="mt-7">
          <h2 className="mb-4 text-sm font-semibold">Indicateurs publiés</h2>
          <Table
            aria-label="Comparaison des modalités"
            data={rows}
            getRowId={(row) => row.key}
            rowHeight={56}
            height={328}
            className="rounded-xl bg-surface [&_table]:min-w-[480px]"
            columns={[
              {
                key: "metric",
                header: "Indicateur",
                cell: (row) => <span className="text-xs">{row.label}</span>,
              },
              {
                key: "classic",
                header: "Hors apprentissage",
                align: "right",
                cell: (row) => (
                  <span className="text-xs tabular-nums">
                    {value(classic.selected, row.key)}
                  </span>
                ),
              },
              {
                key: "apprentice",
                header: "Apprentissage",
                align: "right",
                cell: (row) => (
                  <span className="text-xs tabular-nums">
                    {value(apprentice.selected, row.key)}
                  </span>
                ),
              },
            ]}
          />
          <p className="mt-4 max-w-3xl text-xs leading-5 text-muted-foreground">
            Le jeu apprentissage ne publie ni admis ni taux d’accès officiel
            comparables ici. Une proposition peut dépendre de la recherche d’un
            contrat. Les candidatures se comptent par formation et ne
            correspondent pas à des personnes distinctes entre formations.
          </p>
        </section>
      )}
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <SourceDisclosure source={classic.source} />
        <SourceDisclosure source={apprentice.source} />
      </div>
    </main>
  );
}
