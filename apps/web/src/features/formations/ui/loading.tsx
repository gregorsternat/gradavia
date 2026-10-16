import {
  Skeleton,
  SkeletonCards,
  SkeletonChart,
  SkeletonFilters,
  SkeletonMetrics,
  SkeletonTable,
} from "@/components/skeleton";

export default function LoadingFormations({ view }: { view?: string }) {
  return (
    <>
      <SkeletonFilters count={5} />
      <div className="flex items-center justify-between">
        <Skeleton className="w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div
        className={
          view === "cartes"
            ? "hidden"
            : view === "liste"
              ? ""
              : "hidden md:block"
        }
      >
        <SkeletonTable />
      </div>
      <div
        className={
          view === "liste"
            ? "hidden"
            : `grid gap-4 md:grid-cols-2 2xl:grid-cols-3 ${view !== "cartes" ? "md:hidden" : ""}`
        }
      >
        <SkeletonCards count={6} />
      </div>
    </>
  );
}
export function FavoritesSkeleton() {
  return (
    <>
      <SkeletonFilters count={2} />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <SkeletonCards count={6} />
      </div>
    </>
  );
}
export function ComparisonSkeleton() {
  return (
    <>
      <SkeletonFilters count={2} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCards />
      </div>
      <SkeletonTable columns={4} />
    </>
  );
}
export function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonChart bars />
      <SkeletonMetrics />
      <SkeletonTable columns={3} rows={4} />
    </div>
  );
}
