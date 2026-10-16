import {
  LoadingStatus,
  Skeleton,
  SkeletonCards,
  SkeletonChart,
  SkeletonFilters,
  SkeletonTable,
} from "@/components/skeleton";

export function MapSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div
      data-map-skeleton
      aria-busy={announce || undefined}
      className="relative h-[440px] overflow-hidden rounded-xl border border-border bg-sidebar sm:h-[600px]"
    >
      {announce && <LoadingStatus label="Chargement de la carte…" />}
      <div
        aria-hidden="true"
        className="absolute inset-6 grid grid-cols-3 gap-3 opacity-60"
      >
        <Skeleton className="col-span-2 h-full rounded-3xl" />
        <Skeleton className="h-full rounded-3xl" />
        <Skeleton className="h-full rounded-3xl" />
        <Skeleton className="col-span-2 h-full rounded-3xl" />
      </div>
      <div
        aria-hidden="true"
        className="absolute top-4 left-4 space-y-1 rounded-lg border border-border bg-surface p-2"
      >
        <Skeleton className="size-7" />
        <Skeleton className="size-7" />
      </div>
      <Skeleton className="absolute top-4 right-4 h-8 w-32" />
    </div>
  );
}
export function AtlasSkeleton({ map }: { map: boolean }) {
  return (
    <>
      <SkeletonFilters count={4} />
      <SkeletonFilters count={3} />
      <div
        className={
          map
            ? "grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]"
            : ""
        }
      >
        {map && <MapSkeleton announce={false} />}
        <div className="space-y-4">
          <Skeleton className="w-40" />
          <SkeletonCards count={3} />
        </div>
      </div>
    </>
  );
}
export function ModalitySkeleton() {
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <SkeletonFilters count={2} />
        <SkeletonFilters count={2} />
      </div>
      <SkeletonTable columns={3} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SkeletonChart bars />
        <SkeletonChart bars />
      </div>
    </>
  );
}
export function DataAccessSkeleton() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCards />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </>
  );
}
