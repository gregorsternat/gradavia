import {
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
} from "@/components/skeleton";
export function AnalysisSkeleton() {
  return (
    <>
      <SkeletonFilters count={5} />
      <SkeletonMetrics />
      <SkeletonChart bars />
    </>
  );
}
