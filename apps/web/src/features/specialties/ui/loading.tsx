import {
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
  SkeletonTable,
} from "@/components/skeleton";
export function SpecialtiesSkeleton({
  inverse = false,
}: {
  inverse?: boolean;
}) {
  return (
    <>
      <SkeletonFilters count={inverse ? 1 : 2} />
      {!inverse && <SkeletonMetrics />}
      <SkeletonChart bars />
      <SkeletonTable columns={inverse ? 4 : 5} />
    </>
  );
}
