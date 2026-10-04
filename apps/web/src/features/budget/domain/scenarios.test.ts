import { describe, expect, it } from "vitest";
import { budgetTotals, newScenario, readBudgets } from "./scenarios";

describe("student budget assumptions", () => {
  it("does not silently price an unfilled expense at zero", () => {
    expect(budgetTotals(newScenario("one"))).toBeNull();
    expect(
      budgetTotals({
        ...newScenario("one"),
        rent: "500",
        food: "200",
        transport: "30",
        other: "",
        tuition: "0",
        setup: "0",
      }),
    ).toBeNull();
  });
  it("counts paid months each year and installation only once", () => {
    expect(
      budgetTotals({
        ...newScenario("one"),
        years: 3,
        months: 10,
        rent: "500.50",
        food: "200",
        transport: "30",
        other: "0",
        tuition: "100",
        setup: "500",
      }),
    ).toEqual({ monthly: 730.5, annual: 7405, total: 22715 });
  });
  it("validates local state and preserves an explicit zero", () => {
    const scenario = {
      ...newScenario("one"),
      rent: "0",
      food: "0",
      transport: "0",
      other: "0",
      tuition: "0",
      setup: "0",
    };
    expect(budgetTotals(scenario)?.total).toBe(0);
    expect(
      readBudgets(
        JSON.stringify({ version: 1, scenarios: [scenario, scenario] }),
      ),
    ).toBeNull();
    expect(
      readBudgets(
        JSON.stringify({
          version: 1,
          scenarios: [{ ...scenario, rent: "-1" }],
        }),
      ),
    ).toBeNull();
  });
});
