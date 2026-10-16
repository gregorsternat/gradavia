import {
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
  SkeletonTable,
} from "@/components/skeleton";
export function EvolutionSkeleton() {
  return (
    <>
      <SkeletonFilters count={5} />
      <SkeletonMetrics />
      <div className="grid gap-5 sm:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonTable columns={5} />
    </>
  );
}
