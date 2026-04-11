"use client";

import { Building2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const bottomNav = [
  { href: "/profile", label: "Profile" },
  { href: "/organization", label: "Organization" },
  { href: "/billing", label: "Billing" },
  { href: "/roles", label: "Roles" },
] as const;

function NavLink({
  href,
  label,
  pathname,
  match = "prefix",
  pendingHref,
  dashboardNavigate,
  prefetchRoute,
}: {
  href: string;
  label: string;
  pathname: string;
  match?: "exact" | "prefix";
  pendingHref: string | null;
  dashboardNavigate: (
    href: string,
    match: "exact" | "prefix",
    options?: { skipIfSame?: boolean },
  ) => void;
  prefetchRoute: (href: string) => void;
}) {
  const active =
    match === "exact"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  const navigatingHere = pendingHref === href;

  return (
    <a
      href={href}
      onPointerEnter={() => prefetchRoute(href)}
      onClick={(e) => {
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        dashboardNavigate(href, match);
      }}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors duration-75",
        "active:scale-[0.98] motion-safe:transition-transform",
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        navigatingHere &&
          "bg-zinc-100 ring-2 ring-zinc-900/12 dark:bg-zinc-800 dark:ring-white/12",
      )}
    >
      {label}
    </a>
  );
}

type AppSidebarProps = {
  /** `undefined` = still resolving (show a minimal placeholder in the org slot). */
  organizationName?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  dashboardNavigate: (
    href: string,
    match: "exact" | "prefix",
    options?: { skipIfSame?: boolean },
  ) => void;
  pendingHref: string | null;
  prefetchRoute: (href: string) => void;
};

export function AppSidebar({
  organizationName,
  mobileOpen = false,
  onMobileClose,
  dashboardNavigate,
  pendingHref,
  prefetchRoute,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/35 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => onMobileClose?.()}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-56 flex-col overflow-y-auto border-r border-zinc-200 bg-white transition-transform md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        aria-label="Main navigation"
      >
        <div className="border-b border-zinc-100 px-3 pb-4 pt-5 dark:border-zinc-800">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Building2 className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Organization
              </p>
              <a
                href="/organization"
                onPointerEnter={() => prefetchRoute("/organization")}
                onClick={(e) => {
                  if (
                    e.metaKey ||
                    e.ctrlKey ||
                    e.shiftKey ||
                    e.altKey ||
                    e.button !== 0
                  ) {
                    return;
                  }
                  e.preventDefault();
                  dashboardNavigate("/organization", "exact");
                }}
                className={cn(
                  "mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-zinc-900 transition-colors duration-75 hover:text-zinc-600 active:scale-[0.99] dark:text-zinc-100 dark:hover:text-zinc-300",
                  pendingHref === "/organization" &&
                    "rounded-sm ring-1 ring-zinc-400/45 dark:ring-zinc-500/45",
                )}
              >
                {organizationName === undefined
                  ? "…"
                  : organizationName?.trim() || "Not set"}
              </a>
            </div>
          </div>
        </div>

        <div className="p-3 pt-4">
          <nav className="flex flex-col gap-0.5">
            <NavLink
              href="/dashboard"
              label="Dashboard"
              pathname={pathname}
              match="exact"
              pendingHref={pendingHref}
              dashboardNavigate={dashboardNavigate}
              prefetchRoute={prefetchRoute}
            />
            <NavLink
              href="/deals"
              label="Deals"
              pathname={pathname}
              pendingHref={pendingHref}
              dashboardNavigate={dashboardNavigate}
              prefetchRoute={prefetchRoute}
            />
          </nav>
        </div>

        <div className="min-h-0 flex-1" aria-hidden />

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <nav className="mb-3 flex flex-col gap-0.5">
            {bottomNav.map(({ href, label }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                pathname={pathname}
                pendingHref={pendingHref}
                dashboardNavigate={dashboardNavigate}
                prefetchRoute={prefetchRoute}
              />
            ))}
          </nav>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50/80 px-2 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Theme
            </span>
            <ThemeToggle />
          </div>
          <LogoutButton className="w-full" signOutLabel="Sign out" />
        </div>
      </aside>
    </>
  );
}
