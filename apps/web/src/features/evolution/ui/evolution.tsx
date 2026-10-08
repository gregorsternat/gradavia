"use client";
import { usePanelActive, PanelMain } from "@/features/workspace/ui/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "@/features/workspace/ui/navigation";
import Link from "@/features/workspace/ui/navigation";
import { ArrowDownToLine, Copy, Pause, Play } from "lucide-react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { Button, ButtonLink } from "@/components/motion/button/base";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/motion/tabs";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Table, type TableColumn } from "@/components/motion/table";
import { BarChart } from "@/components/charts/tremor/components/BarChart/BarChart";
import { LineChart } from "@/components/charts/tremor/components/LineChart/LineChart";
import { ChartData } from "@/features/observatory/ui/shared";
import { datasetUrl } from "@/features/formations/domain/explorer";
import {
  formatMeasure,
  measureLabels,
  quantile,
} from "@/features/analysis/domain/analysis";
import {
  cohortLabels,
  evolutionMeasures,
  pairedChanges,
  pairedGroups,
  type EvolutionData,
  type EvolutionMeasure,
} from "../domain/evolution";

const number = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
function Choice({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-9 rounded-lg text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72 overflow-auto">
          {values.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Evolution({ data }: { data: EvolutionData }) {
  const { before, after } = data;
  const router = useRouter();
  const active = usePanelActive();
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const requestedMeasure = searchParams.get("indicateur");
  const measure: EvolutionMeasure = evolutionMeasures.includes(
    requestedMeasure as EvolutionMeasure,
  )
    ? (requestedMeasure as EvolutionMeasure)
    : "capacity";
  const type = (searchParams.get("type") ?? "").slice(0, 200);
  const region = (searchParams.get("region") ?? "").slice(0, 200);
  const mode = searchParams.get("mode") === "index" ? "index" : "count";
  const [notice, setNotice] = useState("");
  const [frame, setFrame] = useState<"before" | "after">("before"),
    [playing, setPlaying] = useState(false);
  const matches = data;
  const cohort = useMemo(
    () =>
      matches.matched.filter(
        (pair) =>
          (!type || pair.type === type) && (!region || pair.region === region),
      ),
    [matches, type, region],
  );
  const pairs = useMemo(
    () => pairedChanges(cohort, measure),
    [cohort, measure],
  );
  const contribution = data.contributions[measure];
  const groups = useMemo(
    () => pairedGroups(pairs, "type", mode === "index"),
    [pairs, mode],
  );
  const regions = [
    ...new Set(
      matches.matched
        .map((pair) => pair.region)
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const types = [
    ...new Set(
      matches.matched
        .map((pair) => pair.type)
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const oldTotal = pairs.reduce((sum, pair) => sum + pair.beforeValue, 0),
    newTotal = pairs.reduce((sum, pair) => sum + pair.afterValue, 0);
  const deltas = pairs.map((pair) => pair.delta).sort((a, b) => a - b),
    q1 = quantile(deltas, 0.25),
    q3 = quantile(deltas, 0.75);
  const lower = q1 === null || q3 === null ? null : q1 - 1.5 * (q3 - q1),
    upper = q1 === null || q3 === null ? null : q3 + 1.5 * (q3 - q1);
  const outliers =
    lower === null || upper === null
      ? []
      : pairs.filter((pair) => pair.delta < lower || pair.delta > upper);
  const max = Math.max(
    1,
    ...groups.flatMap((group) => [group.baseline ?? 0, group.current ?? 0]),
  );
  const sourceParams = new URLSearchParams({
    famille: after.family,
    debut: String(before.source.campaign),
    fin: String(after.source.campaign),
    version_debut: before.source.releaseId,
    version_fin: after.source.releaseId,
    indicateur: measure,
    mode,
    type,
    region,
  });
  const href = `/evolutions?${sourceParams}`;
  const update = (
    key: "indicateur" | "mode" | "type" | "region",
    value: string,
  ) => {
    sourceParams.set(key, value);
    router.replaceState(null, "", `/evolutions?${sourceParams}`);
  };
  const campaignChange = (key: "debut" | "fin", value: string) => {
    sourceParams.set(key, value);
    sourceParams.delete(key === "debut" ? "version_debut" : "version_fin");
    router.push(`/evolutions?${sourceParams}`);
  };
  useEffect(() => {
    if (!playing || reduce || !active) return;
    const timer = window.setInterval(
      () => setFrame((value) => (value === "before" ? "after" : "before")),
      1800,
    );
    return () => window.clearInterval(timer);
  }, [playing, reduce, active]);
  const columns: TableColumn<(typeof pairs)[number]>[] = [
    {
      key: "name",
      header: "Formation",
      width: "350px",
      cell: (pair) => (
        <Link
          className="block truncate font-medium hover:underline"
          href={
            after.family === "parcoursup"
              ? `/formations/${encodeURIComponent(pair.after.id)}`
              : `/atlas/${encodeURIComponent(pair.after.id)}`
          }
          title={pair.title}
        >
          {pair.title}
        </Link>
      ),
    },
    {
      key: "beforeValue",
      header: before.source.campaign,
      align: "right",
      width: "120px",
      sortable: true,
      cell: (pair) => formatMeasure(pair.beforeValue, measure),
    },
    {
      key: "afterValue",
      header: after.source.campaign,
      align: "right",
      width: "120px",
      sortable: true,
      cell: (pair) => formatMeasure(pair.afterValue, measure),
    },
    {
      key: "delta",
      header: "Écart",
      align: "right",
      width: "110px",
      sortable: true,
      cell: (pair) => `${pair.delta > 0 ? "+" : ""}${number(pair.delta)}`,
    },
    {
      key: "index",
      header: `Base 100 (${before.source.campaign})`,
      align: "right",
      width: "150px",
      cell: (pair) => (pair.index === null ? "Base nulle" : number(pair.index)),
    },
    {
      key: "beforeRank",
      header: "Rang avant",
      align: "right",
      width: "110px",
      sortable: true,
    },
    {
      key: "afterRank",
      header: "Rang après",
      align: "right",
      width: "110px",
      sortable: true,
    },
  ];
  const exportJson = () => {
    const content = JSON.stringify(
      {
        schemaVersion: 1,
        family: after.family,
        before: before.source,
        after: after.source,
        definitions: { before: before.definitions, after: after.definitions },
        settings: { measure, type, region, mode },
        valueKeys: data.valueKeys,
        reproduciblePath: href,
        method:
          "Unique nonempty formation and establishment source identifiers; exact unchanged title, establishment, type, city, department, region, status, selectivity. This does not establish unchanged curricula. Observed pairs only; competition ranks within the same paired cohort. Base100 undefined at zero baseline.",
        pairs,
        wholeSourceDecomposition: contribution,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `gradavia-${before.source.campaign}-${after.source.campaign}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <PanelMain id="contenu" tabIndex={-1} className="min-w-0 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Évolutions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {before.source.campaign} → {after.source.campaign} ·{" "}
            {after.family === "apb"
              ? "Archives APB"
              : after.family === "apprentissage"
                ? "Apprentissage"
                : "Parcoursup"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL(href, window.location.origin).href,
                );
                setNotice("Lien copié avec les deux versions de source.");
              } catch {
                router.replaceState(null, "", href);
                setNotice("Copiez l’adresse de cette page.");
              }
            }}
          >
            <Copy className="size-3.5" />
            Partager
          </Button>
          <Button variant="ghost" size="sm" onClick={exportJson}>
            <ArrowDownToLine className="size-3.5" />
            JSON
          </Button>
        </div>
      </div>
      {notice && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      <section
        className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
        aria-label="Paramètres de comparaison"
      >
        <Choice
          label="Campagne initiale"
          value={String(before.source.campaign)}
          values={after.campaigns.map((year) => ({
            value: String(year),
            label: String(year),
          }))}
          onChange={(value) => campaignChange("debut", value)}
        />
        <Choice
          label="Campagne finale"
          value={String(after.source.campaign)}
          values={after.campaigns.map((year) => ({
            value: String(year),
            label: String(year),
          }))}
          onChange={(value) => campaignChange("fin", value)}
        />
        <Choice
          label="Indicateur"
          value={measure}
          values={evolutionMeasures.map((value) => ({
            value,
            label: measureLabels[value],
          }))}
          onChange={(value) => update("indicateur", value)}
        />
        <Choice
          label="Filière"
          value={type}
          values={[
            { value: "", label: "Toutes les filières" },
            ...types.map((value) => ({ value, label: value })),
          ]}
          onChange={(value) => update("type", value)}
        />
        <Choice
          label="Région"
          value={region}
          values={[
            { value: "", label: "Toutes les régions" },
            ...regions.map((value) => ({ value, label: value })),
          ]}
          onChange={(value) => update("region", value)}
        />
        <Choice
          label="Affichage des graphiques"
          value={mode}
          values={[
            { value: "count", label: "Effectifs" },
            { value: "index", label: "Indice base 100" },
          ]}
          onChange={(value) => update("mode", value)}
        />
      </section>
      <p className="mt-5 max-w-4xl text-sm leading-6 text-muted-foreground">
        Le périmètre suivi conserve uniquement les identifiants uniques de
        formation et d’établissement dont la description, la localisation et le
        statut sont inchangés. Cela ne garantit pas un contenu pédagogique
        identique.
      </p>
      <section
        className="mt-6 grid gap-4 sm:grid-cols-3"
        aria-label="Périmètre suivi"
      >
        <div className="rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted-foreground">
            Formations suivies avec les deux valeurs
          </p>
          <p className="mt-2 text-3xl font-medium tabular-nums">
            {number(pairs.length)}{" "}
            <span className="text-base text-muted-foreground">
              / {number(cohort.length)}
            </span>
          </p>
        </div>
        <div className="rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted-foreground">
            {measureLabels[measure]} · {before.source.campaign}
          </p>
          <p className="mt-2 text-3xl font-medium tabular-nums">
            {pairs.length ? number(oldTotal) : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted-foreground">
            {measureLabels[measure]} · {after.source.campaign}
          </p>
          <p className="mt-2 text-3xl font-medium tabular-nums">
            {pairs.length ? number(newTotal) : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {pairs.length
              ? `${newTotal - oldTotal > 0 ? "+" : ""}${number(newTotal - oldTotal)} sur les mêmes lignes observées`
              : "Aucune paire exploitable"}
          </p>
        </div>
      </section>
      <section className="panel mt-6 p-4 sm:p-5">
        <Tabs
          defaultValue="groups"
          variant="underline"
          onValueChange={() => setPlaying(false)}
        >
          <TabsList aria-label="Lecture des évolutions">
            <TabsTrigger value="groups">Avant / après</TabsTrigger>
            <TabsTrigger value="small">Par filière</TabsTrigger>
            <TabsTrigger value="playback">Deux campagnes</TabsTrigger>
          </TabsList>
          <TabsContent value="groups" keepMounted={false}>
            {pairs.length ? (
              <>
                <BarChart
                  className="gradavia-chart h-96"
                  data={groups.slice(0, 12).map((group) => ({
                    label: group.label,
                    [String(before.source.campaign)]: group.baseline,
                    [String(after.source.campaign)]: group.current,
                  }))}
                  index="label"
                  categories={[
                    String(before.source.campaign),
                    String(after.source.campaign),
                  ]}
                  colors={["silver", "charcoal"]}
                  valueFormatter={number}
                  minValue={0}
                  maxValue={max}
                />
                <p className="mt-4 text-xs text-muted-foreground">
                  12 premières filières par valeur initiale, sur des paires
                  identiques.{" "}
                  {mode === "index"
                    ? "Indice = valeur finale / valeur initiale × 100 ; une base nulle n’est pas indexée."
                    : "Les deux campagnes partagent la même échelle."}
                </p>
              </>
            ) : (
              <p className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                Aucune paire observée dans ce périmètre.
              </p>
            )}
          </TabsContent>
          <TabsContent value="small" keepMounted={false}>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {groups.slice(0, 12).map((group) => (
                <div
                  key={group.label}
                  className="min-w-0 rounded-lg bg-subtle p-3"
                >
                  <h2
                    className="truncate text-sm font-medium"
                    title={group.label}
                  >
                    {group.label}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {number(group.records)} formations
                  </p>
                  <LineChart
                    className="gradavia-chart mt-4 h-40"
                    data={[
                      {
                        campaign: String(before.source.campaign),
                        Valeur: group.baseline,
                      },
                      {
                        campaign: String(after.source.campaign),
                        Valeur: group.current,
                      },
                    ]}
                    index="campaign"
                    categories={["Valeur"]}
                    colors={["charcoal"]}
                    showLegend={false}
                    minValue={0}
                    maxValue={max}
                    valueFormatter={number}
                    yAxisWidth={50}
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Même échelle de 0 à {number(max)} pour tous les panneaux. Chaque
              ligne relie deux observations ; elle ne décrit pas les campagnes
              intermédiaires.
            </p>
          </TabsContent>
          <TabsContent value="playback" keepMounted={false}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                variant={frame === "before" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setPlaying(false);
                  setFrame("before");
                }}
              >
                {before.source.campaign}
              </Button>
              <Button
                variant={frame === "after" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setPlaying(false);
                  setFrame("after");
                }}
              >
                {after.source.campaign}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!!reduce}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing && !reduce ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                {playing && !reduce ? "Pause" : "Lecture"}
              </Button>
              <span className="ml-auto text-sm font-medium" aria-live="off">
                Campagne{" "}
                {frame === "before"
                  ? before.source.campaign
                  : after.source.campaign}
              </span>
            </div>
            <BarChart
              className="gradavia-chart h-80"
              data={groups.slice(0, 12).map((group) => ({
                label: group.label,
                Valeur: frame === "before" ? group.baseline : group.current,
              }))}
              index="label"
              categories={["Valeur"]}
              colors={["charcoal"]}
              showLegend={false}
              valueFormatter={number}
              minValue={0}
              maxValue={max}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Alternance des deux campagnes chargées, à échelle fixe.{" "}
              {reduce
                ? "La lecture automatique est désactivée avec la réduction des animations."
                : "La lecture démarre uniquement sur demande."}
            </p>
          </TabsContent>
        </Tabs>
        <ChartData
          title="Évolution par filière"
          data={groups}
          columns={[
            { key: "label", header: "Filière" },
            { key: "before", header: before.source.campaign, align: "right" },
            { key: "after", header: after.source.campaign, align: "right" },
            { key: "records", header: "Paires", align: "right" },
          ]}
        />
      </section>
      <section className="mt-7">
        <h2 className="mb-2 text-base font-medium">
          Écarts et positions relatives
        </h2>
        <p className="mb-4 text-xs leading-5 text-muted-foreground">
          Les rangs comparent uniquement ces {number(pairs.length)} paires, par
          indicateur décroissant. Les ex æquo partagent le même rang ; il ne
          s’agit pas d’un classement de qualité.
        </p>
        <Table
          aria-label="Évolutions des formations suivies"
          data={pairs}
          columns={columns}
          getRowId={(pair) => pair.before.id}
          height={Math.min(450, pairs.length * 44 + 50)}
          rowHeight={44}
          className="text-xs"
        />
      </section>
      <BouncyAccordion
        className="mt-7"
        items={[
          {
            id: "coverage",
            title: "Décomposition du périmètre source",
            description: (
              <div>
                <p className="mb-4 text-xs leading-6 text-muted-foreground">
                  Ensemble des deux sources, avant les filtres de région et de
                  filière. Les entrées et sorties sont celles des identifiants
                  publiés ; elles ne prouvent pas une ouverture ou une
                  fermeture. Les sommes partielles conservent leur couverture.
                </p>
                <Table
                  aria-label="Décomposition de la variation des sources"
                  data={contribution}
                  columns={[
                    { key: "label", header: "Périmètre", width: "300px" },
                    {
                      key: "before",
                      header: before.source.campaign,
                      width: "180px",
                      cell: (part) =>
                        `${part.before.total} lignes · ${formatMeasure(part.before.value, measure)} (${part.before.observed} obs.)`,
                    },
                    {
                      key: "after",
                      header: after.source.campaign,
                      width: "180px",
                      cell: (part) =>
                        `${part.after.total} lignes · ${formatMeasure(part.after.value, measure)} (${part.after.observed} obs.)`,
                    },
                    {
                      key: "delta",
                      header: "Écart des sommes observées",
                      width: "200px",
                      cell: (part) =>
                        part.delta === null
                          ? "Non calculable"
                          : `${part.delta > 0 ? "+" : ""}${number(part.delta)}`,
                    },
                  ]}
                  height={340}
                  rowHeight={44}
                />
                <p className="mt-4 text-xs text-muted-foreground">
                  {cohortLabels.matched} : {matches.matched.length} paires sur{" "}
                  {before.records} lignes initiales et {after.records} lignes
                  finales. La contribution de ce groupe peut aussi inclure des
                  changements de disponibilité des valeurs ; le tableau
                  principal ne retient que les paires observées.
                </p>
              </div>
            ),
          },
          {
            id: "outliers",
            title: `Variations atypiques · ${outliers.length}`,
            description: (
              <div>
                <p className="mb-4 text-xs leading-6 text-muted-foreground">
                  Écarts hors de l’intervalle [
                  {lower === null ? "—" : number(lower)} ;{" "}
                  {upper === null ? "—" : number(upper)}], défini par 1,5 écart
                  interquartile. Un signal descriptif à vérifier dans la source,
                  sans diagnostic de cause ni d’erreur.
                </p>
                <Table
                  aria-label="Variations atypiques des formations"
                  data={outliers}
                  columns={columns}
                  height={Math.min(330, outliers.length * 44 + 50)}
                  rowHeight={44}
                />
              </div>
            ),
          },
          {
            id: "source",
            title: "Sources et continuité",
            description: (
              <div className="space-y-4 text-xs leading-6 text-muted-foreground">
                {[before, after].map((data) => (
                  <p key={`${data.source.releaseId}:${data.source.campaign}`}>
                    <a
                      className="text-foreground underline"
                      href={datasetUrl(data.source.datasetId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {data.source.provider} · {data.source.campaign} ·{" "}
                      {data.source.datasetId}
                    </a>
                    <br />
                    {data.source.license}
                    <br />
                    <span className="break-all">
                      Version {data.source.releaseId}
                    </span>
                    <br />
                    {data.definitions.find(
                      (definition) => definition.key === measure,
                    )?.description ?? "Nombre de lignes de formation publiées."}
                    {data.notices.map((notice) => (
                      <span key={notice} className="block">
                        {notice}
                      </span>
                    ))}
                  </p>
                ))}
                <p>
                  La sélection exige des identifiants non vides, uniques dans
                  chaque source complète. Toute modification exacte du titre, de
                  l’établissement, de la filière, de la commune, du département,
                  de la région, du statut ou de la sélectivité exclut la paire.
                  Un identifiant identique ne prouve jamais à lui seul la
                  stabilité d’une formation. APB, Parcoursup et apprentissage
                  sont des familles séparées.
                </p>
                <p>
                  Seuls les effectifs publiés sont comparés ; aucune moyenne de
                  pourcentages ni probabilité individuelle n’est calculée. Les
                  candidatures restent des candidatures par formation, pas des
                  personnes dédupliquées.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink
                    href={`/analyses?famille=${before.family}&campagne=${before.source.campaign}&version=${before.source.releaseId}`}
                    variant="secondary"
                    size="sm"
                  >
                    Analyser {before.source.campaign}
                  </ButtonLink>
                  <ButtonLink
                    href={`/analyses?famille=${after.family}&campagne=${after.source.campaign}&version=${after.source.releaseId}`}
                    variant="secondary"
                    size="sm"
                  >
                    Analyser {after.source.campaign}
                  </ButtonLink>
                </div>
              </div>
            ),
          },
        ]}
      />
    </PanelMain>
  );
}
