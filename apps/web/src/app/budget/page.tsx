import { pageMetadata } from "@/features/seo/domain/metadata";
import { BudgetCalculator } from "@/features/budget/ui/calculator";
export const metadata = pageMetadata("/budget");
export default function BudgetPage() {
  return <BudgetCalculator />;
}
