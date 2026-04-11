import type { ReactNode } from "react";

function formatDate(iso: string | undefined | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function ProfileDetailRows({
  rows,
}: {
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-4 text-sm">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="grid gap-1 border-b border-zinc-100 pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:gap-6 dark:border-zinc-800"
        >
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
          <dd className="min-w-0 break-words text-zinc-900 dark:text-zinc-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ data }: { data: unknown }) {
  if (data === undefined || data === null) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  if (typeof data === "object" && Object.keys(data as object).length === 0) {
    return <span className="text-zinc-400 dark:text-zinc-500">{}</span>;
  }
  return (
    <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export { formatDate };
