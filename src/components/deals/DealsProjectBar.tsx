import Link from "next/link";

import { cn } from "@/lib/utils";

export type DealsProjectBarItem = { id: string; name: string };

export function DealsProjectBar({
  projects,
  activeProjectId,
}: {
  projects: DealsProjectBarItem[];
  activeProjectId: "all" | string;
}) {
  if (projects.length <= 1) return null;

  const chip =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors";
  const active =
    "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  const idle =
    "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Filter by project
      </span>
      <Link
        href="/deals"
        className={cn(chip, activeProjectId === "all" ? active : idle)}
      >
        All
      </Link>
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/deals?project=${p.id}`}
          className={cn(chip, activeProjectId === p.id ? active : idle)}
        >
          {p.name}
        </Link>
      ))}
    </div>
  );
}
