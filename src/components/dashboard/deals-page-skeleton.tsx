import { Skeleton } from "@/components/ui/skeleton";

export function DealsPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading deals">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Skeleton className="mb-4 h-5 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
