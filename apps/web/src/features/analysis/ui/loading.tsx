import {
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
  SkeletonTable,
} from "@/components/skeleton";
export function AnalysisSkeleton() {
  return (
    <>
      <SkeletonFilters count={5} />
      <SkeletonMetrics />
      <SkeletonChart bars />
      <SkeletonTable columns={5} />
    </>
  );
}
