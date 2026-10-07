import { describe, expect, it } from "vitest";
import {
  navigationGroup,
  navigationGroups,
  representationUrl,
  scopeUrl,
} from "./navigation";

describe("navigation ownership", () => {
  it("keeps five main destinations and every existing tool reachable", () => {
    expect(navigationGroups.slice(0, 5).map((group) => group.label)).toEqual([
      "Formations",
      "Spécialités du bac",
      "Comparer",
      "Mon projet",
      "Observatoire",
    ]);
    for (const group of navigationGroups)
      for (const page of group.pages)
        expect(navigationGroup(page.href)?.href).toBe(group.href);
    expect(navigationGroup("/formations/release%3A1")?.href).toBe(
      "/formations",
    );
    expect(navigationGroup("/specialites/inverse")?.href).toBe("/specialites");
    expect(navigationGroup("/carte", "apb")?.href).toBe("/sources");
    expect(navigationGroup("/formations-unrelated")).toBeUndefined();
  });
});

describe("representation and source boundaries", () => {
  it("round-trips compatible filters and maps sort names", () => {
    const original = new URLSearchParams({
      campagne: "2024",
      q: "BTS",
      type: "BTS",
      region: "Île-de-France",
      statut: "Public",
      tri: "capacite",
      departement: "Paris",
      selectivite: "Sélective",
      page: "3",
      vue: "cartes",
    });
    const map = new URL(
      representationUrl("/formations", original, "carte"),
      "https://example.test",
    );
    expect(Object.fromEntries(map.searchParams)).toEqual({
      campagne: "2024",
      q: "BTS",
      type: "BTS",
      region: "Île-de-France",
      statut: "Public",
      tri: "capacity",
    });
    const list = new URL(
      representationUrl("/carte", map.searchParams, "liste"),
      "https://example.test",
    );
    expect(list.searchParams.get("tri")).toBe("capacite");
    expect(list.searchParams.get("region")).toBe("Île-de-France");
  });
  it("does not apply atlas release IDs, spatial filters or personal sorts to paginated search", () => {
    expect(
      representationUrl(
        "/carte",
        new URLSearchParams(
          "campagne=2024&version=old&ville=Lyon&rayon=10&tri=priorities&acces_min=40&similaire=old%3A1",
        ),
        "liste",
      ),
    ).toBe("/formations?campagne=2024");
  });
  it("keeps the apprenticeship snapshot and all supported criteria between views", () => {
    const params = new URLSearchParams(
      "famille=apprentissage&version=retained&campagne=2024&q=BTS&ville=Lyon&rayon=10&tri=distance",
    );
    const list = new URL(
      representationUrl("/carte", params, "liste"),
      "https://example.test",
    );
    expect(list.pathname).toBe("/apprentissage");
    expect(list.searchParams.get("version")).toBe("retained");
    expect(list.searchParams.get("rayon")).toBe("10");
    const map = new URL(
      representationUrl("/apprentissage", list.searchParams, "carte"),
      "https://example.test",
    );
    expect(map.searchParams.get("vue")).toBe("carte");
    map.searchParams.delete("vue");
    expect(map.searchParams.toString()).toBe(params.toString());
  });
  it("does not reinterpret ignored family or sort parameters in the regular list", () => {
    expect(
      representationUrl(
        "/formations",
        new URLSearchParams("famille=apprentissage&tri=toString"),
        "carte",
      ),
    ).toBe("/carte");
  });
  it("changes populations explicitly without transferring releases, taxonomies or campaigns", () => {
    const params = new URLSearchParams(
      "q=BTS&campagne=2017&version=archive&type=BTS&region=Paris",
    );
    expect(scopeUrl(params, "apprentissage", "liste")).toBe(
      "/apprentissage?q=BTS&vue=liste",
    );
    expect(scopeUrl(params, "parcoursup", "carte")).toBe("/carte?q=BTS");
  });
});
