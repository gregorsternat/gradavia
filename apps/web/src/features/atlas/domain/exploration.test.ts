import { describe, expect, it } from "vitest";
import type { AtlasItem } from "./api-contract";
import {
  distanceKm,
  filterItems,
  parseExploration,
  peerSummary,
  sortItems,
  inBounds,
  cityChoices,
  matchesCity,
  boundNumericFilter,
} from "./exploration";

function row(id: string, values: Partial<AtlasItem> = {}): AtlasItem {
  return {
    id,
    sourceFormationId: id,
    establishmentId: "UAI",
    title: "Licence informatique",
    establishment: "Université",
    city: "Lyon",
    department: "Rhône",
    region: "ARA",
    type: "Licence",
    status: "Public",
    selectivity: "Non sélective",
    latitude: 45.75,
    longitude: 4.85,
    metrics: {
      capacity: 100,
      applications: 1000,
      offers: 500,
      admitted: 95,
      accessRate: 50,
      femaleShare: 40,
      scholarshipShare: 30,
      generalBacShare: 75,
      technologyBacShare: 20,
      vocationalBacShare: 5,
      localShare: 60,
    },
    states: {},
    ...values,
  };
}
describe("geographic exploration", () => {
  it("measures great-circle kilometres and crosses the antimeridian", () => {
    expect(
      distanceKm(
        { latitude: 48.8566, longitude: 2.3522 },
        { latitude: 45.764, longitude: 4.8357 },
      ),
    ).toBeCloseTo(391.5, 0);
    expect(
      distanceKm(
        { latitude: 0, longitude: 179.9 },
        { latitude: 0, longitude: -179.9 },
      ),
    ).toBeCloseTo(22.24, 1);
    expect(
      inBounds(row("east", { latitude: 0, longitude: -179 }), {
        south: -10,
        north: 10,
        west: 175,
        east: -175,
      }),
    ).toBe(true);
  });
  it("does not turn unpublished observations into numeric filter matches", () => {
    const observed = row("observed");
    const missing = row("missing", {
      metrics: { ...observed.metrics, capacity: null },
      states: { capacity: "suppressed" },
    });
    const zero = row("zero", { metrics: { ...observed.metrics, capacity: 0 } });
    expect(
      filterItems(
        [observed, missing, zero],
        parseExploration({ places_max: "0" }),
      ).map((item) => item.id),
    ).toEqual(["zero"]);
    expect(
      filterItems([observed, missing, zero], parseExploration({})),
    ).toHaveLength(3);
  });
  it("uses literal accent-folded AND search, exact facets and declared interest words", () => {
    const items = [
      row("one", { title: "École d’informatique", city: "Lyon" }),
      row("two", { title: "Économie", city: "Lyon" }),
    ];
    expect(
      filterItems(items, parseExploration({ q: "ecole lyon" })).map(
        (item) => item.id,
      ),
    ).toEqual(["one"]);
    expect(
      filterItems(items, parseExploration({ interet: "numerique" })).map(
        (item) => item.id,
      ),
    ).toEqual(["one"]);
    expect(filterItems(items, parseExploration({ q: "%" }))).toEqual([]);
  });
  it("excludes missing coordinates only when radius filtering requires them", () => {
    const items = [
      row("known"),
      row("unknown", { latitude: null, longitude: null }),
    ];
    expect(filterItems(items, parseExploration({}))).toHaveLength(2);
    expect(
      filterItems(items, parseExploration({ ville: "Lyon", rayon: "10" }), {
        latitude: 45.75,
        longitude: 4.85,
      }).map((item) => item.id),
    ).toEqual(["known"]);
    expect(filterItems(items, parseExploration({ ville: "Inconnue" }))).toEqual(
      [],
    );
  });
  it("bounds incoming parameters and preserves zero thresholds", () => {
    const query = parseExploration({
      places_min: "0",
      rayon: "900",
      acces_max: "NaN",
      q: "x".repeat(500),
      tri: "chance",
    });
    expect(query).toMatchObject({
      minCapacity: "0",
      radius: 500,
      maxAccess: "",
      sort: "name",
    });
    expect(query.q).toHaveLength(160);
    expect(parseExploration({ acces_max: "150", rayon: "0" })).toMatchObject({
      maxAccess: "100",
      radius: 1,
    });
    expect(boundNumericFilter("-20")).toBe("0");
    expect(boundNumericFilter("200", 100)).toBe("100");
    expect(boundNumericFilter("0", 100)).toBe("0");
    expect(boundNumericFilter("", 100)).toBe("");
    expect(boundNumericFilter("Infinity", 100)).toBe("");
  });
  it("finds literal city or department names without scattered-letter matches", () => {
    expect(matchesCity("Lyon · Rhône", "lyon")).toBe(true);
    expect(matchesCity("Lyon · Rhône", "rhone")).toBe(true);
    expect(
      matchesCity("La Rochelle · Charente-Maritime", " la  rochelle "),
    ).toBe(true);
    expect(matchesCity("Étampes · Essonne", "etampes")).toBe(true);
    expect(matchesCity("Argelès-sur-Mer · Pyrénées-Orientales", "Lyon")).toBe(
      false,
    );
    expect(matchesCity("Aulnay-sous-Bois · Seine-Saint-Denis", "Lyon")).toBe(
      false,
    );
    expect(matchesCity("Lyon · Rhône", "")).toBe(true);
  });
  it("normalizes source spacing in city choices while keeping a published coordinate", () => {
    const cities = cityChoices([
      row("one", { city: " La  Rochelle ", department: "Charente  Maritime" }),
      row("two", {
        city: "La Rochelle",
        department: "Charente Maritime",
        latitude: 49,
      }),
    ]);
    expect(cities).toEqual([
      {
        value: "La Rochelle · Charente Maritime",
        label: "La Rochelle · Charente Maritime",
        latitude: 45.75,
        longitude: 4.85,
      },
    ]);
    expect(
      parseExploration({ ville: " La  Rochelle · Charente  Maritime " }).city,
    ).toBe(cities[0]!.value);
  });
  it("keeps peer population explicit, excludes self and calculates medians with ties", () => {
    const reference = row("ref");
    const peers = [
      reference,
      row("one", { metrics: { ...reference.metrics, capacity: 50 } }),
      row("two", { metrics: { ...reference.metrics, capacity: 150 } }),
      row("other", { type: "BTS" }),
    ];
    const result = peerSummary(peers, reference);
    expect(result.count).toBe(2);
    expect(result.positions[0]).toMatchObject({
      median: 100,
      below: 1,
      count: 2,
      value: 100,
    });
    expect(result.alternatives.map((item) => item.id)).not.toContain("ref");
  });
  it("scores missing values as unavailable and sorts observed zero capacity as smallest", () => {
    const first = row("first");
    const items = [
      first,
      row("zero", { metrics: { ...first.metrics, capacity: 0 } }),
      row("missing", {
        metrics: { ...first.metrics, capacity: null },
        states: { capacity: "missing" },
      }),
    ];
    expect(
      sortItems(
        items,
        parseExploration({ tri: "priorities", taille: "100" }),
      ).map((item) => item.id),
    ).toEqual(["zero", "first", "missing"]);
    expect(
      sortItems(items, parseExploration({ tri: "capacity" })).map(
        (item) => item.id,
      ),
    ).toEqual(["first", "zero", "missing"]);
  });
  it("orders alternatives by shared words, distance and title while retaining stable ties", () => {
    const reference = row("ref", { title: "Licence informatique systèmes" });
    const rows = [
      reference,
      row("far", {
        title: "Informatique systèmes",
        latitude: 48.85,
        longitude: 2.35,
      }),
      row("near", { title: "Informatique systèmes" }),
      row("missing-z", {
        title: "Informatique systèmes Z",
        latitude: null,
        longitude: null,
      }),
      row("missing-a", {
        title: "Informatique systèmes A",
        latitude: null,
        longitude: null,
      }),
      row("tie-first", { title: "Informatique" }),
      row("tie-second", { title: "Informatique" }),
      row("unrelated", { title: "Biologie" }),
    ];
    const originalOrder = rows.map((item) => item.id);
    expect(
      peerSummary(rows, reference).alternatives.map((item) => item.id),
    ).toEqual([
      "near",
      "far",
      "missing-a",
      "missing-z",
      "tie-first",
      "tie-second",
    ]);
    expect(rows.map((item) => item.id)).toEqual(originalOrder);
  });
});
