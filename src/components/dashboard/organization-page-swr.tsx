"use client";

import useSWR from "swr";

import { OrganizationDashboardView } from "@/components/dashboard/organization-dashboard-view";
import { StackPageSkeleton } from "@/components/dashboard/stack-page-skeleton";
import { DashboardPanel } from "@/components/layout/dashboard-shell";
import type { OrganizationApiResult } from "@/lib/dashboard-api/load-organization";

const KEY = "/api/dashboard/organization";

const fetcher = async (url: string): Promise<OrganizationApiResult> => {
  const res = await fetch(url, { credentials: "same-origin" });
  return res.json() as Promise<OrganizationApiResult>;
};

export function OrganizationPageSwr() {
  const { data, error, isLoading, isValidating } = useSWR(KEY, fetcher, {
    revalidateOnMount: true,
  });

  if (error) {
    return (
      <DashboardPanel title="Organization" description="Load error.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Could not load organization data.
        </p>
      </DashboardPanel>
    );
  }

  if (!data && isLoading) {
    return <StackPageSkeleton label="Loading organization" />;
  }

  if (data && !data.ok) {
    return (
      <DashboardPanel title="Organization" description="Sign in to continue.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {data.message}
        </p>
      </DashboardPanel>
    );
  }

  if (!data?.ok) {
    return <StackPageSkeleton label="Loading organization" />;
  }

  return (
    <div
      className={
        isValidating ? "opacity-90 transition-opacity duration-150" : undefined
      }
    >
      <OrganizationDashboardView data={data} />
    </div>
  );
}
