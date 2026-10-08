import { describe, expect, it } from "vitest";
import { canonicalHref } from "../../workspace/domain/registry";
import { searchCommands } from "../../../lib/command-search";
import { navigationGroup, navigationGroups } from "./navigation";

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

describe("legacy command palette aliases", () => {
  it.each([
    ["intérêts", ["/carte"]],
    ["sauvegarder", ["/favoris"]],
    ["bac général", ["/specialites"]],
    ["villes", ["/territoires"]],
    ["statistiques", ["/observatoire", "/analyses"]],
  ] as const)(
    "keeps the existing destinations searchable with %s",
    (query, destinations) => {
      const commands = navigationGroups.flatMap((group) =>
        group.pages.map((page) => ({ ...page, group: group.label })),
      );
      const matches = searchCommands(commands, query).map((page) => page.href);
      expect(matches).toEqual(
        expect.arrayContaining(destinations.map(canonicalHref)),
      );
    },
  );
});
