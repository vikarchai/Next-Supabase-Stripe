import { Skeleton } from "@/components/ui/skeleton";

export function StackPageSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <Skeleton className="mb-2 h-6 w-56" />
          <Skeleton className="mb-4 h-4 w-full max-w-md" />
          <Skeleton className="h-32 w-full" />
        </div>
      ))}
    </div>
  );
}
