import { z } from "zod";

const amount = z
  .string()
  .max(12)
  .refine(
    (value) =>
      value === "" ||
      (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 1_000_000),
  );
export const scenarioSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().max(80),
  city: z.string().max(80),
  years: z.number().int().min(1).max(8),
  months: z.number().int().min(1).max(12),
  rent: amount,
  food: amount,
  transport: amount,
  other: amount,
  tuition: amount,
  setup: amount,
});
export type BudgetScenario = z.infer<typeof scenarioSchema>;
const workspace = z.object({
  version: z.literal(1),
  scenarios: z.array(scenarioSchema).min(1).max(4),
});
export const budgetFields = [
  { key: "rent", label: "Logement / mois" },
  { key: "food", label: "Alimentation / mois" },
  { key: "transport", label: "Transport / mois" },
  { key: "other", label: "Autres dépenses / mois" },
  { key: "tuition", label: "Frais de formation / an" },
  { key: "setup", label: "Installation, une seule fois" },
] as const;
export function newScenario(id: string): BudgetScenario {
  return {
    id,
    name: "",
    city: "",
    years: 3,
    months: 12,
    rent: "",
    food: "",
    transport: "",
    other: "",
    tuition: "",
    setup: "",
  };
}
export function budgetTotals(scenario: BudgetScenario) {
  if (
    !scenarioSchema.safeParse(scenario).success ||
    budgetFields.some(({ key }) => scenario[key] === "")
  )
    return null;
  const monthly =
    Number(scenario.rent) +
    Number(scenario.food) +
    Number(scenario.transport) +
    Number(scenario.other);
  const annual = monthly * scenario.months + Number(scenario.tuition);
  return {
    monthly: Math.round(monthly * 100) / 100,
    annual: Math.round(annual * 100) / 100,
    total:
      Math.round((annual * scenario.years + Number(scenario.setup)) * 100) /
      100,
  };
}
export function readBudgets(raw: string | null): BudgetScenario[] | null {
  if (!raw || raw.length > 16_000) return null;
  try {
    const result = workspace.safeParse(JSON.parse(raw));
    return result.success &&
      new Set(result.data.scenarios.map((item) => item.id)).size ===
        result.data.scenarios.length
      ? result.data.scenarios
      : null;
  } catch {
    return null;
  }
}
