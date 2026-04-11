"use client";

import useSWR from "swr";

import { StackPageSkeleton } from "@/components/dashboard/stack-page-skeleton";
import {
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import { OrganizationRolesCard } from "@/components/roles/organization-roles-card";
import type { RolesApiResult } from "@/lib/dashboard-api/load-roles";

const KEY = "/api/dashboard/roles";

const fetcher = async (url: string): Promise<RolesApiResult> => {
  const res = await fetch(url, { credentials: "same-origin" });
  return res.json() as Promise<RolesApiResult>;
};

export function RolesPageSwr() {
  const { data, error, isLoading, isValidating } = useSWR(KEY, fetcher, {
    revalidateOnMount: true,
  });

  if (error) {
    return (
      <DashboardPanel title="Roles" description="Load error.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Could not load roles.
        </p>
      </DashboardPanel>
    );
  }

  if (!data && isLoading) {
    return <StackPageSkeleton label="Loading roles" />;
  }

  if (data && !data.ok) {
    return (
      <DashboardPanel title="Roles" description="Access or setup.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {data.message}
        </p>
      </DashboardPanel>
    );
  }

  if (!data?.ok) {
    return <StackPageSkeleton label="Loading roles" />;
  }

  return (
    <div
      className={
        isValidating ? "opacity-90 transition-opacity duration-150" : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <OrganizationRolesCard
          description="Built-in and custom roles. Edit permissions from the modal."
          roles={data.rolesForClient}
          catalogPermissions={data.catalogPermissions}
          allowCreateRole={data.allowCreateRole}
          allowEditRoles={data.allowEditRoles}
          allowDeleteRoles={data.allowDeleteRoles}
          allowRenameRole={data.allowRenameRole}
        />

        <DashboardPanel
          title="Permissions catalog"
          description="All permission codes (global). Assign them to roles via Edit or Create."
        >
          {data.catalogPermissions.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No permissions yet. Insert rows into{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-200">
                permissions
              </code>{" "}
              (e.g. via migration or SQL).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="pb-3 pr-4 font-medium">Code</th>
                    <th className="pb-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.catalogPermissions.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                        {p.code}
                      </td>
                      <td className="py-2 text-zinc-700 dark:text-zinc-300">
                        {p.description ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
