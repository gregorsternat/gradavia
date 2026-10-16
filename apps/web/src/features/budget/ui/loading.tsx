import {
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
} from "@/components/skeleton";
export function BudgetSkeleton() {
  return (
    <>
      <SkeletonFilters count={2} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="panel space-y-6 p-5">
            <SkeletonFilters count={6} />
            <SkeletonMetrics />
          </div>
        ))}
      </div>
      <SkeletonChart bars />
    </>
  );
}
