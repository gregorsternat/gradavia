import { describe, expect, test } from "vitest";
import {
  matchesSpecialtyPair,
  parseIndicator,
  sortObservations,
  specialtiesUrl,
  specialtyCsv,
} from "./explorer";
import type { SpecialtyObservation } from "./api-contract";
import type {
  CampaignSource,
  Metric,
} from "../../formations/domain/api-contract";
const value = (
  number: number | null,
  state: Metric["state"] = "observed",
): Metric => ({ value: number, state, sourceField: "voeux" });
const row = (id: number, count: Metric): SpecialtyObservation => ({
  id: `11111111-1111-4111-8111-111111111111:${id}`,
  group: `Groupe ${id}`,
  formation: `Formation ${id}`,
  applications: count,
  offers: count,
  accepted: count,
});

describe("specialty source semantics", () => {
  test("sorts within a scope without treating masked or missing candidates as zero", () => {
    const rows = [
      row(1, value(null, "suppressed")),
      row(2, value(0)),
      row(3, value(120)),
      row(4, value(null, "missing")),
    ];
    expect(
      sortObservations(rows, "applications").map((item) => item.id),
    ).toEqual([3, 2, 1, 4].map((id) => row(id, value(0)).id));
    expect(rows[0]!.applications.state).toBe("suppressed");
  });
  test("preserves opaque pair identity and exact group labels in shareable URLs", () => {
    const pair = JSON.stringify(["Mathématiques", "Physique-Chimie"]);
    const url = new URL(
      specialtiesUrl(pair, "Licence & sciences", "accepted"),
      "https://gradavia.test",
    );
    expect(url.searchParams.get("paire")).toBe(pair);
    expect(url.searchParams.get("groupe")).toBe("Licence & sciences");
    expect(parseIndicator(url.searchParams.get("tri")!)).toBe("accepted");
    expect(parseIndicator("invalid")).toBe("applications");
  });
  test("exports scope, suppressed states and source release without summing overlapping populations", () => {
    const rows = [row(1, value(650)), row(2, value(null, "suppressed"))];
    const csv = specialtyCsv(
      rows,
      {
        campaign: 2025,
        datasetId: "source",
        releaseId: "release",
      } as CampaignSource,
      "Mathématiques + Physique-Chimie",
      "group",
    );
    expect(csv.split("\r\n")).toHaveLength(4);
    expect(csv).toContain('"group"');
    expect(csv).toContain('"";"suppressed";"voeux"');
    expect(csv).toContain('"release"');
    expect(csv).not.toContain('"Total"');
    const [header, ...body] = csv.trimEnd().split("\r\n");
    expect(header).toMatch(/;"Unité";"Population";"Limites d’agrégation"$/);
    for (const exportedRow of body) {
      expect(exportedRow).toContain(';"Candidats (effectifs)";');
      expect(exportedRow).toContain("Bacheliers généraux de cette combinaison");
      expect(exportedRow).toContain("au moins un vœu confirmé");
      expect(exportedRow).toMatch(
        /plusieurs groupes ou formations\. Ne pas additionner les lignes ni les niveaux\."$/,
      );
    }
    expect(body[0]).toContain(';"650";"observed";"voeux";');
  });
});

describe("specialty pair search", () => {
  test("matches math aliases and accent-free subject queries together", () => {
    const labels = ["Mathématiques + Physique-Chimie"];
    expect(matchesSpecialtyPair("MATHS + physique chimie", labels)).toBe(true);
    expect(matchesSpecialtyPair("math", labels)).toBe(true);
    expect(matchesSpecialtyPair("mathématiques physique", labels)).toBe(true);
    expect(labels).toEqual(["Mathématiques + Physique-Chimie"]);
  });
  test("recognizes established abbreviations only when the full subject agrees", () => {
    expect(
      matchesSpecialtyPair("maths SVT", [
        "Mathématiques",
        "Sciences de la vie et de la Terre",
      ]),
    ).toBe(true);
    expect(
      matchesSpecialtyPair("NSI", [
        "Numérique et sciences informatiques",
        "Mathématiques",
      ]),
    ).toBe(true);
    expect(
      matchesSpecialtyPair("SES", [
        "Sciences économiques et sociales",
        "Mathématiques",
      ]),
    ).toBe(true);
    expect(
      matchesSpecialtyPair("HGGSP", [
        "Histoire-géographie, géopolitique et sciences politiques",
      ]),
    ).toBe(true);
    expect(matchesSpecialtyPair("SES", ["Sciences politiques"])).toBe(false);
    expect(matchesSpecialtyPair("NSI", ["Sciences de l’ingénieur"])).toBe(
      false,
    );
    expect(
      matchesSpecialtyPair("SVT", ["Numérique et sciences informatiques"]),
    ).toBe(false);
    expect(
      matchesSpecialtyPair("sesame", ["Sciences économiques et sociales"]),
    ).toBe(false);
  });
});
