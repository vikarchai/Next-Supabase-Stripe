"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { DashboardNavProgress } from "@/components/layout/dashboard-nav-progress";
import { DASHBOARD_ORG_STORAGE_KEY } from "@/lib/dashboard-client-storage";

const DASHBOARD_PREFETCH_HREFS = [
  "/dashboard",
  "/deals",
  "/profile",
  "/organization",
  "/billing",
  "/roles",
] as const;

/**
 * Client-only shell: fixed sidebar + mobile top bar.
 * Page `{children}` must stay in the **server** layout as a sibling — wrapping RSC
 * pages inside this client component breaks App Router soft navigations (pathname
 * and server work can diverge).
 */
export function DashboardClientChrome({
  organizationName: organizationNameFromServer,
}: Readonly<{
  organizationName?: string | null;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavPending, startNavTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const initial = useMemo<string | null | undefined>(() => {
    return organizationNameFromServer;
  }, [organizationNameFromServer]);

  const [organizationName, setOrganizationName] = useState<string | null | undefined>(initial);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(DASHBOARD_ORG_STORAGE_KEY);
      if (cached !== null) {
        setOrganizationName(cached || null);
        return;
      }
    } catch {
      /* private mode */
    }

    setOrganizationName(organizationNameFromServer);
  }, [organizationNameFromServer]);

  useEffect(() => {
    if (organizationName === undefined) return;
    try {
      sessionStorage.setItem(
        DASHBOARD_ORG_STORAGE_KEY,
        organizationName ?? "",
      );
    } catch {
      /* ignore */
    }
  }, [organizationName]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref) return;
    const t = window.setTimeout(() => setPendingHref(null), 12_000);
    return () => window.clearTimeout(t);
  }, [pendingHref]);

  useEffect(() => {
    for (const href of DASHBOARD_PREFETCH_HREFS) {
      void router.prefetch(href);
    }
  }, [router]);

  const prefetchRoute = useCallback(
    (href: string) => {
      void router.prefetch(href);
    },
    [router],
  );

  const dashboardNavigate = useCallback(
    (
      href: string,
      match: "exact" | "prefix",
      options?: { skipIfSame?: boolean },
    ) => {
      setMobileSidebarOpen(false);
      const skip = options?.skipIfSame !== false;
      if (skip) {
        const already =
          match === "exact"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        if (already) return;
      }
      setPendingHref(href);
      startNavTransition(() => {
        router.push(href);
      });
    },
    [pathname, router],
  );

  const showNavProgress = pendingHref !== null || isNavPending;

  return (
    <>
      <DashboardNavProgress visible={showNavProgress} />
      <AppSidebar
        organizationName={organizationName}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        dashboardNavigate={dashboardNavigate}
        pendingHref={pendingHref}
        prefetchRoute={prefetchRoute}
      />
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Organization
            </p>
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {organizationName === undefined
                ? "…"
                : organizationName?.trim() || "Not set"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
