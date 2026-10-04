"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MapPin, SlidersHorizontal, Search, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { InlineSlider } from "@/components/motion/range-slider-inline";
import { Checkbox } from "@/components/motion/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import {
  SelectField,
  SourceDisclosure,
  ShareButton,
  FormationActions,
  Reveal,
} from "@/features/formations/ui/shared";
import { formatCount } from "@/features/formations/domain/metrics";
import type { AtlasData, AtlasResult } from "../domain/api-contract";
import {
  atlasFormation,
  atlasItemUrl,
  boundNumericFilter,
  cityChoices,
  distanceKm,
  explorationUrl,
  familyLabels,
  filterItems,
  hasCoordinates,
  interests,
  parseExploration,
  sortItems,
  type ExplorationQuery,
  type GeoBounds,
} from "../domain/exploration";
import { FormationMap } from "./formation-map";

const numberClass = { field: "rounded-lg", input: "text-sm", label: "text-xs" };

function ReadyExplorer({
  data,
  initialQuery,
}: {
  data: AtlasData;
  initialQuery: ExplorationQuery;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = useMemo(
    () =>
      searchParams
        ? parseExploration(
            Object.fromEntries(
              [...new Set(searchParams.keys())].map((key) => [
                key,
                searchParams.getAll(key),
              ]),
            ),
          )
        : initialQuery,
    [searchParams, initialQuery],
  );
  const [radiusInput, setRadiusInput] = useState(String(initialQuery.radius));
  const [bounds, setBounds] = useState<GeoBounds>();
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [limit, setLimit] = useState(20);
  const cities = useMemo(() => cityChoices(data.items), [data.items]);
  const center = useMemo(
    () => cities.find((city) => city.value === query.city),
    [cities, query.city],
  );
  const filtered = useMemo(
    () => filterItems(data.items, query, center),
    [data.items, query, center],
  );
  const visible = useMemo(
    () =>
      sortItems(
        visibleOnly && bounds
          ? filterItems(filtered, { ...query, reference: "" }, center, bounds)
          : filtered,
        query,
        center,
      ),
    [filtered, query, visibleOnly, bounds, center],
  );
  const plotted = filtered.filter(hasCoordinates).length;
  const selected = data.items.find((row) => row.id === selectedId);
  const reference = data.items.find((row) => row.id === query.reference);
  const selectedInterest = interests.find((item) => item.id === query.interest);
  const change = (patch: Partial<ExplorationQuery>) => {
    const next = { ...query, ...patch };
    if (patch.radius !== undefined) setRadiusInput(String(patch.radius));
    setLimit(20);
    window.history.replaceState(
      null,
      "",
      explorationUrl(data, next, window.location.pathname),
    );
  };
  const facet = (key: "type" | "region" | "status") =>
    [
      ...new Set(data.items.flatMap((row) => (row[key] ? [row[key]!] : []))),
    ].sort((a, b) => a.localeCompare(b, "fr"));
  const totalPlaces = filtered.reduce(
    (sum, row) => sum + (row.metrics.capacity ?? 0),
    0,
  );
  const capacityCoverage = filtered.filter(
    (row) => row.metrics.capacity !== null,
  ).length;
  const widen = query.region
    ? { ...query, region: "" }
    : query.type
      ? { ...query, type: "" }
      : query.city
        ? { ...query, radius: Math.min(500, query.radius * 2) }
        : null;
  const widerCount = widen
    ? filterItems(data.items, widen, center).length - filtered.length
    : 0;
  const range = (
    label: string,
    min: keyof ExplorationQuery,
    max: keyof ExplorationQuery,
    maximum = 100_000_000,
  ) => (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={`${label} minimum`}
          placeholder="Minimum"
          type="number"
          min="0"
          max={maximum}
          value={String(query[min])}
          onChange={(value) =>
            change({ [min]: boundNumericFilter(value, maximum) })
          }
          classNames={numberClass}
        />
        <Input
          aria-label={`${label} maximum`}
          placeholder="Maximum"
          type="number"
          min="0"
          max={maximum}
          value={String(query[max])}
          onChange={(value) =>
            change({ [max]: boundNumericFilter(value, maximum) })
          }
          classNames={numberClass}
        />
      </div>
    </fieldset>
  );
  return (
    <main id="contenu" className="min-w-0 flex-1 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">
            {data.family === "apb"
              ? "Explorer les archives APB"
              : data.family === "apprentissage"
                ? "Explorer l’apprentissage"
                : "Explorer la carte"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {familyLabels[data.family]} · Campagne {data.source.campaign}
          </p>
        </div>
        <div className="flex gap-2">
          <ShareButton />
          <ButtonLink
            variant="secondary"
            size="sm"
            href={`/analyses?famille=${data.family}&campagne=${data.source.campaign}&version=${data.source.releaseId}`}
          >
            Analyser <ArrowRight className="size-3.5" />
          </ButtonLink>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_180px]">
        <Input
          aria-label="Rechercher dans la carte"
          placeholder="Formation, établissement, ville…"
          value={query.q}
          onChange={(q) => change({ q })}
          leftIcon={<Search />}
          classNames={numberClass}
        />
        <SelectField
          label="Campagne de la carte"
          value={String(data.source.campaign)}
          onChange={(campagne) =>
            router.push(`/carte?famille=${data.family}&campagne=${campagne}`)
          }
          options={data.campaigns.map((year) => ({
            value: String(year),
            label: `Campagne ${year}`,
          }))}
        />
        <SelectField
          label="Périmètre des formations"
          value={data.family}
          onChange={(famille) => router.push(`/carte?famille=${famille}`)}
          options={Object.entries(familyLabels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Domaine d’intérêt"
          value={query.interest}
          onChange={(interest) => change({ interest })}
          options={[
            { value: "", label: "Tous les centres d’intérêt" },
            ...interests.map(({ id, label }) => ({ value: id, label })),
          ]}
        />
        <SelectField
          label="Type dans la carte"
          value={query.type}
          onChange={(type) => change({ type })}
          options={[
            { value: "", label: "Tous les types" },
            ...facet("type").map((value) => ({ value, label: value })),
          ]}
        />
        <SelectField
          label="Région dans la carte"
          value={query.region}
          onChange={(region) => change({ region })}
          options={[
            { value: "", label: "Toutes les régions" },
            ...facet("region").map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      {selectedInterest && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Recherche par mots-clés dans les intitulés. Domaines voisins :
          </span>
          {selectedInterest.neighbors.map((id) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => change({ interest: id })}
            >
              {interests.find((item) => item.id === id)?.label}
            </Button>
          ))}
        </div>
      )}
      <BouncyAccordion
        className="my-4"
        classNames={{
          item: "rounded-xl border border-border bg-surface",
          title: "text-xs font-medium",
          trigger: "px-4 py-3",
          description: "px-4 pb-4",
          content: "overflow-visible",
        }}
        items={[
          {
            id: "criteria",
            title: "Proximité et critères",
            icon: <SlidersHorizontal className="size-4" />,
            description: (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium">
                      Autour d’une ville
                    </p>
                    <Combobox
                      value={query.city}
                      onValueChange={(city) => change({ city })}
                    >
                      <ComboboxTrigger className="rounded-lg bg-background">
                        <ComboboxInput
                          aria-label="Autour d’une ville"
                          placeholder="Choisir une ville publiée"
                          className="text-sm"
                        />
                      </ComboboxTrigger>
                      <ComboboxContent>
                        <ComboboxList ariaLabel="Villes publiées">
                          {cities.map((city) => (
                            <ComboboxItem
                              key={city.value}
                              value={city.value}
                              textValue={city.label}
                              className="text-xs"
                            >
                              {city.label}
                            </ComboboxItem>
                          ))}
                          <ComboboxEmpty>
                            Aucune ville ne correspond.
                          </ComboboxEmpty>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    {query.city && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => change({ city: "" })}
                      >
                        Retirer la ville
                      </Button>
                    )}
                    {query.city && !center && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Choisissez une ville dans les suggestions.
                      </p>
                    )}
                  </div>
                  <div className="space-y-3 pt-5">
                    <InlineSlider
                      label="Rayon"
                      min={1}
                      max={500}
                      step={1}
                      value={query.radius}
                      onValueChange={(radius) => change({ radius })}
                      format={(value) => `${Math.round(value)} km`}
                      aria-label="Rayon en kilomètres"
                    />
                    <Input
                      aria-label="Rayon exact en kilomètres"
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={radiusInput}
                      onChange={(value) => {
                        if (!value) {
                          setRadiusInput("");
                          return;
                        }
                        const radius = Number(value);
                        if (Number.isFinite(radius))
                          change({
                            radius: Math.min(
                              500,
                              Math.max(1, Math.round(radius)),
                            ),
                          });
                      }}
                      onBlur={() => setRadiusInput(String(query.radius))}
                      classNames={numberClass}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Distance à vol d’oiseau depuis un établissement repère publié
                  dans la ville, sans estimation du temps de trajet.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {range("Places", "minCapacity", "maxCapacity")}
                  {range("Taux d’accès (%)", "minAccess", "maxAccess", 100)}
                  {range("Candidatures", "minApplications", "maxApplications")}
                </div>
                <SelectField
                  label="Statut dans la carte"
                  value={query.status}
                  onChange={(status) => change({ status })}
                  options={[
                    { value: "", label: "Tous les statuts" },
                    ...facet("status").map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <InlineSlider
                    label="Proximité"
                    value={query.nearbyWeight}
                    onValueChange={(nearbyWeight) =>
                      change({ nearbyWeight, sort: "priorities" })
                    }
                    aria-label="Importance de la proximité"
                    disabled={!center}
                  />
                  <InlineSlider
                    label="Petites promotions"
                    value={query.sizeWeight}
                    onValueChange={(sizeWeight) =>
                      change({ sizeWeight, sort: "priorities" })
                    }
                    aria-label="Importance des petites promotions"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Le tri personnel favorise une distance et une capacité plus
                  faibles selon vos poids. Une valeur non publiée ne reçoit
                  aucun point. Ce tri ne mesure ni la qualité ni les chances
                  d’admission.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    change({
                      ...initialQuery,
                      q: "",
                      type: "",
                      region: "",
                      status: "",
                      city: "",
                      interest: "",
                      minCapacity: "",
                      maxCapacity: "",
                      minAccess: "",
                      maxAccess: "",
                      minApplications: "",
                      maxApplications: "",
                      reference: "",
                    })
                  }
                >
                  Réinitialiser les critères
                </Button>
              </div>
            ),
          },
        ]}
      />
      {reference && (
        <div className="mb-4 flex items-center gap-2 text-xs">
          <p>
            Alternatives à {reference.title} · même type et même sélectivité
            publiée.
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Retirer la formation de référence"
            onClick={() => change({ reference: "" })}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm">
          <strong className="font-semibold">
            {formatCount(filtered.length)} formations
          </strong>
          <span className="ml-3 text-xs text-muted-foreground">
            {capacityCoverage
              ? `${formatCount(totalPlaces)} places publiées · ${capacityCoverage}/${filtered.length} lignes`
              : "Places non publiées"}
          </span>
        </p>
        {widen && widerCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => change(widen)}>
            Élargir{" "}
            {query.region
              ? "à toutes les régions"
              : query.type
                ? "à tous les types"
                : "le rayon"}{" "}
            · +{formatCount(widerCount)}
          </Button>
        )}
      </div>
      {data.notices.length > 0 && (
        <details className="mb-5 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Périmètre et limites</summary>
          {data.notices.map((notice) => (
            <p key={notice} className="mt-2 leading-5">
              {notice}
            </p>
          ))}
        </details>
      )}
      <div
        className={`grid items-start gap-5 ${data.family !== "apb" ? "xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]" : ""}`}
      >
        {data.family !== "apb" && (
          <section className="min-w-0 xl:sticky xl:top-20">
            <FormationMap
              items={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBounds={setBounds}
              center={center}
              radius={query.radius}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {formatCount(plotted)} localisées ·{" "}
                {formatCount(filtered.length - plotted)} sans coordonnées
              </p>
              <Checkbox
                checked={visibleOnly}
                onCheckedChange={setVisibleOnly}
                label="Limiter la liste à la zone visible"
              />
            </div>
            {selected && (
              <Reveal className="mt-4 rounded-xl bg-subtle p-4">
                <Link
                  className="text-sm font-medium hover:underline"
                  href={atlasItemUrl(selected, data.family)}
                >
                  {selected.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.establishment} · {selected.city}
                </p>
              </Reveal>
            )}
          </section>
        )}
        <section aria-label="Formations de la carte" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">
              {formatCount(visible.length)} résultats
              {visibleOnly ? " dans la zone" : ""}
            </h2>
            <SelectField
              label="Ordre des résultats de la carte"
              value={query.sort}
              onChange={(sort) =>
                change({ sort: sort as ExplorationQuery["sort"] })
              }
              options={[
                { value: "name", label: "Intitulé" },
                { value: "capacity", label: "Plus de places" },
                { value: "applications", label: "Plus de candidatures" },
                ...(center
                  ? [{ value: "distance", label: "Les plus proches" }]
                  : []),
                { value: "priorities", label: "Mes priorités" },
              ]}
              className="w-44"
            />
          </div>
          <div className="space-y-3">
            {visible.slice(0, limit).map((row) => (
              <article
                key={row.id}
                className={`rounded-xl border p-4 ${row.id === selectedId ? "border-foreground bg-subtle" : "border-border bg-surface"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    className="text-sm font-medium leading-5 hover:underline"
                    href={atlasItemUrl(row, data.family)}
                  >
                    {row.title}
                  </Link>
                  {hasCoordinates(row) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Localiser ${row.title}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <MapPin className="size-3.5" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {row.establishment ?? "Établissement non renseigné"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.city ?? row.department ?? "Lieu non renseigné"}
                  {center && hasCoordinates(row)
                    ? ` · ${Math.round(distanceKm(center, row))} km`
                    : ""}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs tabular-nums">
                    {row.metrics.capacity === null
                      ? row.states.capacity === "suppressed"
                        ? "Places masquées"
                        : row.states.capacity === "invalid"
                          ? "Places invalides dans la source"
                          : "Places non publiées"
                      : `${formatCount(row.metrics.capacity)} places`}
                    {row.metrics.accessRate !== null && (
                      <span className="ml-3 text-muted-foreground">
                        Accès {row.metrics.accessRate.toLocaleString("fr-FR")} %
                      </span>
                    )}
                  </p>
                  {data.family === "parcoursup" && (
                    <FormationActions
                      formation={atlasFormation(row, data)}
                      campaign={data.source.campaign}
                    />
                  )}
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucune formation ne correspond à ces critères.
            </p>
          )}
          {visible.length > limit && (
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setLimit((value) => value + 20)}
            >
              Afficher 20 formations de plus
            </Button>
          )}
        </section>
      </div>
      <div className="mt-8">
        <SourceDisclosure source={data.source} />
      </div>
    </main>
  );
}

export function AtlasExplorer({
  result,
  initialQuery,
}: {
  result: AtlasResult;
  initialQuery: ExplorationQuery;
}) {
  if (result.status === "ready")
    return (
      <ReadyExplorer
        key={`${result.data.source.releaseId}:${result.data.source.campaign}`}
        data={result.data}
        initialQuery={initialQuery}
      />
    );
  return (
    <main id="contenu" className="py-12">
      <h1 className="text-2xl font-semibold">
        {result.status === "not-found"
          ? "Cette version n’est pas disponible."
          : result.status === "empty"
            ? "Aucune campagne publiée dans ce périmètre."
            : "Les données sont temporairement indisponibles."}
      </h1>
      <ButtonLink href="/carte" variant="secondary" className="mt-6">
        Revenir à la carte
      </ButtonLink>
    </main>
  );
}
