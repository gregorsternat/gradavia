import { describe, expect, it } from "vitest";
import {
  canonicalHref,
  panelHref,
  resolvePanel,
  resourceKey,
  representationParams,
} from "./registry";
const query = (value = "") => new URLSearchParams(value);
describe("workspace navigation", () => {
  it("redirects legacy tools without losing explicit empty selections or fragments", () => {
    expect(canonicalHref("/modalites?classique=one&campagne=2025#source")).toBe(
      "/comparer?classique=one&campagne=2025&onglet=modalites#source",
    );
    expect(canonicalHref("/comparer?ids=")).toBe("/comparer?ids=");
    expect(canonicalHref("/favoris?partage=1&ids=one#notes")).toBe(
      "/favoris?partage=1&ids=one#notes",
    );
    expect(canonicalHref("/budget")).toBe("/favoris?onglet=budget");
    expect(canonicalHref("/formations/immutable")).toBe(
      "/formations/immutable",
    );
  });
  it("keeps apprenticeship and APB in their proper spaces", () => {
    expect(canonicalHref("/apprentissage?vue=liste&version=retained")).toBe(
      "/formations?version=retained&famille=apprentissage",
    );
    expect(
      resolvePanel("/formations", query("famille=apprentissage&onglet=carte")),
    ).toBe("apprentissage-carte");
    expect(canonicalHref("/carte?famille=apb&version=old")).toBe(
      "/sources?version=old&onglet=archives",
    );
    expect(resolvePanel("/observatoire", query("onglet=unknown"))).toBe(
      "overview",
    );
  });
  it("shares compatible data keys but never mixes campaigns, families or explicit selections", () => {
    expect(resourceKey("overview", query("campagne=2025"))).toBe(
      resourceKey("territoires", query("campagne=2025")),
    );
    expect(resourceKey("sources", query())).toBe(
      resourceKey("donnees", query()),
    );
    expect(resourceKey("carte", query("q=lyon"))).toBe(
      resourceKey("carte", query("q=paris")),
    );
    expect(resourceKey("carte", query())).not.toBe(
      resourceKey("apprentissage", query()),
    );
    expect(resourceKey("selection", query())).not.toBe(
      resourceKey("selection", query("ids=")),
    );
  });
  it("restores view-only criteria and invalidates pagination only for changed common filters", () => {
    const list = query("q=lyon&departement=Rhône&page=3&tri=nom");
    const map = representationParams(
      "formations",
      "carte",
      list,
      query("ville=Lyon&rayon=25"),
    );
    expect(map.get("ville")).toBe("Lyon");
    expect(map.has("departement")).toBe(false);
    expect(
      representationParams("carte", "formations", map, list).get("page"),
    ).toBe("3");
    map.set("q", "paris");
    const next = representationParams("carte", "formations", map, list);
    expect(next.has("page")).toBe(false);
    expect(next.get("departement")).toBe("Rhône");
    expect(panelHref("carte", map)).toContain("onglet=carte");
  });
});
