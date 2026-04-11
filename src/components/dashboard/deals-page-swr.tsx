"use client";

import { Suspense, useMemo } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";

import { DealsPageContent } from "@/components/deals/DealsPageContent";
import { DealsPageSkeleton } from "@/components/dashboard/deals-page-skeleton";
import {
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import type { DealsApiResult } from "@/lib/dashboard-api/load-deals";

const fetcher = async (url: string): Promise<DealsApiResult> => {
  const res = await fetch(url, { credentials: "same-origin" });
  return res.json() as Promise<DealsApiResult>;
};

function dealsUrl(projectQuery: string) {
  if (!projectQuery.trim()) return "/api/dashboard/deals";
  return `/api/dashboard/deals?project=${encodeURIComponent(projectQuery.trim())}`;
}

function DealsPageSwrInner({
  initialProjectQuery,
}: {
  initialProjectQuery: string;
}) {
  const sp = useSearchParams();
  const projectFromUrl = sp.get("project");
  const projectQuery =
    projectFromUrl !== null ? projectFromUrl : initialProjectQuery;

  const key = useMemo(() => dealsUrl(projectQuery), [projectQuery]);

  const { data, error, isLoading, isValidating } = useSWR(key, fetcher, {
    revalidateOnMount: true,
  });

  if (error) {
    return (
      <DashboardPanel title="Deals" description="Could not load deals.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Network error. Check your connection and try again.
        </p>
      </DashboardPanel>
    );
  }

  if (!data && isLoading) {
    return <DealsPageSkeleton />;
  }

  if (data && !data.ok) {
    const msg =
      data.code === "unauthenticated"
        ? "Not authenticated."
        : data.code === "no_organization"
          ? "Your profile has no organization."
          : data.code === "forbidden"
            ? "You don’t have permission to view deals (deals:read)."
            : data.code === "no_projects"
              ? "This organization has no projects yet."
              : data.message;
    return (
      <DashboardPanel title="Deals" description="Access or setup issue.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p>
      </DashboardPanel>
    );
  }

  if (!data?.ok) {
    return <DealsPageSkeleton />;
  }

  return (
    <div
      className={
        isValidating ? "opacity-90 transition-opacity duration-150" : undefined
      }
    >
      <DealsPageContent
        rows={data.rows}
        canCreateDeal={data.canCreateDeal}
        createDealBlockedReason={data.createDealBlockedReason}
        canUpdateDeal={data.canUpdateDeal}
        canDeleteDeal={data.canDeleteDeal}
        dealProjects={data.dealProjects}
        defaultProjectId={data.defaultProjectId}
        projectFilterId={data.projectFilterId}
        projectScopeDescription={data.projectScopeDescription}
      />
    </div>
  );
}

export function DealsPageSwr({
  initialProjectQuery,
}: {
  initialProjectQuery: string;
}) {
  return (
    <Suspense fallback={<DealsPageSkeleton />}>
      <DealsPageSwrInner initialProjectQuery={initialProjectQuery} />
    </Suspense>
  );
}
