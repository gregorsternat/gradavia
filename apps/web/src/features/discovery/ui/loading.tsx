import { Skeleton } from "@/components/skeleton";
export function QuizSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Skeleton className="h-2 w-full" />
      <div className="panel space-y-6 p-6 sm:p-8">
        <Skeleton className="w-24" />
        <Skeleton className="h-7 w-4/5" />
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}
