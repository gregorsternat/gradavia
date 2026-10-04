import type { Metadata } from "next";
import { BudgetCalculator } from "@/features/budget/ui/calculator";
export const metadata: Metadata = { title: "Budget étudiant · vos scénarios" };
export default function BudgetPage() {
  return <BudgetCalculator />;
}
