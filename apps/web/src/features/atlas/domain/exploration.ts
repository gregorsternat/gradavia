import type { AtlasData, AtlasItem, AtlasMetricKey } from "./api-contract";
import type { Formation } from "@/features/formations/domain/api-contract";
import type { SearchParams } from "@/features/formations/domain/explorer";

export const familyLabels = {
  parcoursup: "Parcoursup",
  apprentissage: "Apprentissage",
  apb: "Archives APB",
} as const;
export const interests = [
  {
    id: "numerique",
    label: "Informatique et numérique",
    words: ["informatique", "numerique", "statistique", "donnees", "reseaux"],
    neighbors: ["sciences", "industrie"],
  },
  {
    id: "environnement",
    label: "Environnement et vivant",
    words: [
      "environnement",
      "ecologie",
      "agronomie",
      "biologie",
      "energie",
      "agricole",
      "geographie",
    ],
    neighbors: ["sciences", "industrie"],
  },
  {
    id: "accompagner",
    label: "Santé et accompagnement",
    words: [
      "sante",
      "infirmier",
      "social",
      "psychologie",
      "education",
      "medecine",
      "orthophonie",
    ],
    neighbors: ["societe", "sciences"],
  },
  {
    id: "creation",
    label: "Arts et création",
    words: [
      "art",
      "design",
      "architecture",
      "audiovisuel",
      "musique",
      "communication",
    ],
    neighbors: ["societe", "numerique"],
  },
  {
    id: "sciences",
    label: "Sciences et recherche",
    words: [
      "mathematique",
      "physique",
      "chimie",
      "science",
      "statistique",
      "biologie",
    ],
    neighbors: ["numerique", "environnement"],
  },
  {
    id: "industrie",
    label: "Industrie et construction",
    words: [
      "mecanique",
      "electronique",
      "electrique",
      "industriel",
      "genie",
      "batiment",
      "energie",
    ],
    neighbors: ["sciences", "numerique"],
  },
  {
    id: "societe",
    label: "Société et échanges",
    words: [
      "droit",
      "economie",
      "gestion",
      "commerce",
      "lettres",
      "langue",
      "histoire",
      "sociologie",
    ],
    neighbors: ["accompagner", "creation"],
  },
] as const;

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae");
}

export type GeoBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};
export type ExplorationQuery = {
  q: string;
  type: string;
  region: string;
  status: string;
  interest: string;
  city: string;
  radius: number;
  minCapacity: string;
  maxCapacity: string;
  minAccess: string;
  maxAccess: string;
  minApplications: string;
  maxApplications: string;
  sort: "name" | "distance" | "capacity" | "applications" | "priorities";
  nearbyWeight: number;
  sizeWeight: number;
  reference: string;
};

export function boundNumericFilter(value: string, maximum = 100_000_000) {
  if (!value.trim() || !Number.isFinite(Number(value))) return "";
  return String(Math.max(0, Math.min(maximum, Number(value))));
}

export function parseExploration(params: SearchParams): ExplorationQuery {
  const string = (key: string, trim = true) => {
    const value = String(
      Array.isArray(params[key])
        ? (params[key]?.[0] ?? "")
        : (params[key] ?? ""),
    );
    return (trim ? value.trim() : value).slice(0, 160);
  };
  const numeric = (key: string, maximum = 100_000_000) =>
    /^\d+(\.\d+)?$/.test(string(key)) && Number(string(key)) <= 100_000_000
      ? boundNumericFilter(string(key), maximum)
      : "";
  const sort = string("tri");
  return {
    q: string("q", false),
    type: string("type"),
    region: string("region"),
    status: string("statut"),
    interest: interests.some((item) => item.id === string("interet"))
      ? string("interet")
      : "",
    city: string("ville").replace(/\s+/g, " "),
    radius: Math.min(500, Math.max(1, Number(numeric("rayon") || "50"))),
    minCapacity: numeric("places_min"),
    maxCapacity: numeric("places_max"),
    minAccess: numeric("acces_min", 100),
    maxAccess: numeric("acces_max", 100),
    minApplications: numeric("voeux_min"),
    maxApplications: numeric("voeux_max"),
    sort: ["distance", "capacity", "applications", "priorities"].includes(sort)
      ? (sort as ExplorationQuery["sort"])
      : "name",
    nearbyWeight: Math.min(100, Number(numeric("proximite")) || 0),
    sizeWeight: Math.min(100, Number(numeric("taille")) || 0),
    reference: string("similaire"),
  };
}

export function explorationUrl(
  data: AtlasData,
  query: ExplorationQuery,
  path = "/carte",
): string {
  const params = new URLSearchParams({
    famille: data.family,
    campagne: String(data.source.campaign),
    version: data.source.releaseId,
  });
  for (const [key, value] of Object.entries({
    q: query.q,
    type: query.type,
    region: query.region,
    statut: query.status,
    interet: query.interest,
    ville: query.city,
    rayon: query.city ? query.radius : "",
    places_min: query.minCapacity,
    places_max: query.maxCapacity,
    acces_min: query.minAccess,
    acces_max: query.maxAccess,
    voeux_min: query.minApplications,
    voeux_max: query.maxApplications,
    tri: query.sort === "name" ? "" : query.sort,
    proximite: query.nearbyWeight || "",
    taille: query.sizeWeight || "",
    similaire: query.reference,
  }))
    if (value !== "") params.set(key, String(value));
  return `${path}?${params}`;
}

export function hasCoordinates(
  row: AtlasItem,
): row is AtlasItem & { latitude: number; longitude: number } {
  return row.latitude !== null && row.longitude !== null;
}
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return (
    6371.0088 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, x)), Math.sqrt(Math.max(0, 1 - x)))
  );
}
export function matchesCity(value: string, query: string): boolean {
  const normalize = (text: string) => fold(text).replace(/\s+/g, " ").trim();
  return normalize(value).includes(normalize(query));
}

export function cityChoices(items: AtlasItem[]) {
  const cities = new Map<
    string,
    { value: string; label: string; latitude: number; longitude: number }
  >();
  for (const row of items)
    if (row.city && hasCoordinates(row)) {
      const value = `${row.city} · ${row.department ?? row.region ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
      // Use an actual published establishment point, never an invented city centroid.
      if (!cities.has(value))
        cities.set(value, {
          value,
          label: value,
          latitude: row.latitude,
          longitude: row.longitude,
        });
    }
  return [...cities.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "fr"),
  );
}
export function inBounds(row: AtlasItem, bounds: GeoBounds): boolean {
  return (
    hasCoordinates(row) &&
    row.latitude >= bounds.south &&
    row.latitude <= bounds.north &&
    (bounds.west <= bounds.east
      ? row.longitude >= bounds.west && row.longitude <= bounds.east
      : row.longitude >= bounds.west || row.longitude <= bounds.east)
  );
}
function inRange(value: number | null, min: string, max: string) {
  return (
    (!min && !max) ||
    (value !== null &&
      (!min || value >= Number(min)) &&
      (!max || value <= Number(max)))
  );
}
export function filterItems(
  items: AtlasItem[],
  query: ExplorationQuery,
  center?: { latitude: number; longitude: number },
  bounds?: GeoBounds,
): AtlasItem[] {
  const terms = fold(query.q).split(/\s+/).filter(Boolean);
  const interest = interests.find((item) => item.id === query.interest);
  const reference = items.find((item) => item.id === query.reference);
  return items.filter((row) => {
    if (
      (query.type && row.type !== query.type) ||
      (query.region && row.region !== query.region) ||
      (query.status && row.status !== query.status)
    )
      return false;
    if (
      reference &&
      (row.id === reference.id ||
        row.type !== reference.type ||
        (reference.selectivity && row.selectivity !== reference.selectivity))
    )
      return false;
    const text = fold(
      [row.title, row.establishment, row.city, row.department, row.region].join(
        " ",
      ),
    );
    if (!terms.every((term) => text.includes(term))) return false;
    if (
      interest &&
      !interest.words.some((term) => fold(row.title).includes(term))
    )
      return false;
    if (
      !inRange(row.metrics.capacity, query.minCapacity, query.maxCapacity) ||
      !inRange(row.metrics.accessRate, query.minAccess, query.maxAccess) ||
      !inRange(
        row.metrics.applications,
        query.minApplications,
        query.maxApplications,
      )
    )
      return false;
    if (
      query.city &&
      (!center ||
        !hasCoordinates(row) ||
        distanceKm(center, row) > query.radius)
    )
      return false;
    return !bounds || inBounds(row, bounds);
  });
}
export function sortItems(
  items: AtlasItem[],
  query: ExplorationQuery,
  center?: { latitude: number; longitude: number },
): AtlasItem[] {
  const name = (a: AtlasItem, b: AtlasItem) =>
    a.title.localeCompare(b.title, "fr") ||
    (a.establishment ?? "").localeCompare(b.establishment ?? "", "fr") ||
    a.id.localeCompare(b.id);
  const distance = (row: AtlasItem) =>
    center && hasCoordinates(row) ? distanceKm(center, row) : Infinity;
  const score = (row: AtlasItem) =>
    (query.nearbyWeight
      ? query.nearbyWeight *
        (Number.isFinite(distance(row)) ? 1 / (1 + distance(row) / 50) : 0)
      : 0) +
    query.sizeWeight *
      (row.metrics.capacity !== null
        ? 1 / (1 + row.metrics.capacity / 100)
        : 0);
  return [...items].sort((a, b) => {
    if (query.sort === "distance")
      return distance(a) - distance(b) || name(a, b);
    if (query.sort === "priorities") return score(b) - score(a) || name(a, b);
    if (query.sort === "capacity" || query.sort === "applications")
      return (
        (b.metrics[query.sort] ?? -1) - (a.metrics[query.sort] ?? -1) ||
        name(a, b)
      );
    return name(a, b);
  });
}
export function atlasFormation(row: AtlasItem, data: AtlasData): Formation {
  const metrics = Object.fromEntries(
    Object.entries(row.metrics)
      .filter(([key]) => key !== "localShare")
      .map(([key, value]) => [
        key,
        {
          value,
          state: row.states[key as AtlasMetricKey] ?? "observed",
          sourceField:
            data.definitions.find((definition) => definition.key === key)
              ?.field ?? "",
        },
      ]),
  ) as Formation["metrics"];
  return { ...row, metrics, parcoursupUrl: null };
}
export function atlasItemUrl(
  row: AtlasItem,
  family: AtlasData["family"],
): string {
  return `${family === "parcoursup" ? "/formations" : "/atlas"}/${encodeURIComponent(row.id)}`;
}

export function peerSummary(items: AtlasItem[], reference: AtlasItem) {
  const peers = items.filter(
    (row) =>
      reference.type !== null &&
      row.id !== reference.id &&
      row.type === reference.type &&
      row.selectivity === reference.selectivity,
  );
  const keys = ["capacity", "applications", "accessRate"] as const;
  const positions = keys.map((key) => {
    const values = peers
      .flatMap((row) => (row.metrics[key] === null ? [] : [row.metrics[key]!]))
      .sort((a, b) => a - b);
    const value = reference.metrics[key];
    return {
      key,
      count: values.length,
      median: values.length
        ? (values[Math.floor((values.length - 1) / 2)]! +
            values[Math.ceil((values.length - 1) / 2)]!) /
          2
        : null,
      below:
        value === null ? null : values.filter((item) => item < value).length,
      value,
    };
  });
  const words = new Set(
    fold(reference.title)
      .split(/[^a-z0-9]+/)
      .filter(
        (word) =>
          word.length > 3 &&
          ![
            "licence",
            "master",
            "formation",
            "diplome",
            "brevet",
            "technicien",
            "superieur",
            "parcours",
          ].includes(word),
      ),
  );
  const similarity = (row: AtlasItem) =>
    fold(row.title)
      .split(/[^a-z0-9]+/)
      .filter((word) => words.has(word)).length;
  const alternatives = [...peers]
    .sort(
      (a, b) =>
        similarity(b) - similarity(a) ||
        (hasCoordinates(reference)
          ? (hasCoordinates(a) ? distanceKm(reference, a) : Infinity) -
            (hasCoordinates(b) ? distanceKm(reference, b) : Infinity)
          : 0) ||
        a.title.localeCompare(b.title, "fr"),
    )
    .slice(0, 6);
  return { count: peers.length, positions, alternatives };
}
