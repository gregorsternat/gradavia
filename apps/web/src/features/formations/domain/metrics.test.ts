import { describe, expect, test } from "vitest";
import {
  metric,
  type CampaignSource,
  type Formation,
  type FormationMetrics,
} from "./api-contract";
import {
  formatMetric,
  formationsCsv,
  metricLabels,
  observedMetric,
} from "./metrics";
const observed = (value: number) => ({
  value,
  state: "observed" as const,
  sourceField: "example",
});

describe("indicator presentation", () => {
  test("preserves observed zero, decimal rates and distinct unavailable states", () => {
    expect(formatMetric(observed(0), "admitted")).toBe("0");
    expect(formatMetric(observed(12.5), "accessRate")).toBe("12,5 %");
    expect(
      formatMetric(
        { value: null, state: "suppressed", sourceField: "x" },
        "admitted",
      ),
    ).toBe("Masqué");
    expect(
      formatMetric(
        { value: null, state: "missing", sourceField: "x" },
        "admitted",
      ),
    ).toBe("Non publié");
    expect(
      formatMetric(
        { value: null, state: "invalid", sourceField: "x" },
        "admitted",
      ),
    ).toBe("Invalide");
    expect(observedMetric(null, "admitted")).toBeNull();
    expect(
      metric.safeParse({ value: 0, state: "missing", sourceField: "x" })
        .success,
    ).toBe(false);
    expect(
      metric.safeParse({ value: null, state: "observed", sourceField: "x" })
        .success,
    ).toBe(false);
  });
  test("exports raw numbers with provenance and states without spreadsheet formula injection", () => {
    const metrics = Object.fromEntries(
      Object.keys(metricLabels).map((key) => [key, observed(0)]),
    ) as FormationMetrics;
    metrics.accessRate = {
      value: null,
      state: "suppressed",
      sourceField: "taux_acces_ens",
    };
    metrics.femaleShare = observed(12.5);
    const formation = {
      title: '=HYPERLINK("bad")',
      establishment: "Université; test",
      city: " \t+CMD()",
      region: null,
      type: "Licence",
      metrics,
    } as Formation;
    const source = {
      campaign: 2025,
      datasetId: "source",
      releaseId: "release",
    } as CampaignSource;
    const csv = formationsCsv([{ formation, source }]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\' \t+CMD()"');
    expect(csv).toContain('"Université; test"');
    expect(csv).toContain('"";"suppressed";"taux_acces_ens"');
    expect(csv).toContain('"2025"');
    expect(csv).toContain('"release"');
    expect(csv).toContain(';"12.5";"observed";"example";');
    const [header, exportedRow] = csv.trimEnd().split("\r\n");
    expect(header).toMatch(/;"Périmètre et limites"$/);
    expect(exportedRow).toContain("Parcoursup hors apprentissage");
    expect(exportedRow).toContain(
      "leur somme ne représente pas des personnes distinctes",
    );
    expect(exportedRow).toContain("Pourcentages de 0 à 100");
    expect(exportedRow).toMatch(
      /Le taux d’accès n’est pas une probabilité individuelle d’admission\."$/,
    );
  });
});
