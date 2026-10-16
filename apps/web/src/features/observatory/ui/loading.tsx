import {
  Skeleton,
  SkeletonCards,
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
  SkeletonTable,
} from "@/components/skeleton";

export default function ObservatoryLoading() {
  return (
    <>
      <SkeletonMetrics count={4} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(280px,1fr)]">
        <SkeletonChart />
        <div className="panel flex min-h-72 flex-col items-center justify-center gap-5 p-5">
          <Skeleton className="size-40 rounded-full" />
          <Skeleton className="w-32" />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <SkeletonChart bars />
        <SkeletonChart bars />
      </div>
    </>
  );
}
export function TerritoriesSkeleton() {
  return (
    <>
      <SkeletonFilters count={2} />
      <SkeletonChart bars />
      <SkeletonTable />
    </>
  );
}
export function SourcesSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCards />
      </div>
      <SkeletonTable columns={3} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </>
  );
}
