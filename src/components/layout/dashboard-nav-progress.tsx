"use client";

/** Fixed 2px bar — pair with `dashboard-nav-progress__bar` in globals.css */
export function DashboardNavProgress({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-zinc-200/90 dark:bg-zinc-700/90"
      aria-hidden
    >
      <div className="dashboard-nav-progress__bar h-full w-2/5 bg-zinc-700 dark:bg-zinc-300" />
    </div>
  );
}
