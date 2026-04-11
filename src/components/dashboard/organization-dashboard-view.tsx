"use client";

import {
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import { InviteMemberButton } from "@/components/organization/invite-member-dialog";
import { OrganizationSwitcher } from "@/components/organization/organization-switcher";
import { OrganizationProjectsPanel } from "@/components/organization/organization-projects-panel";
import { PendingInviteActions } from "@/components/organization/pending-invite-actions";
import {
  formatDate,
  ProfileDetailRows,
} from "@/components/profile/profile-detail-rows";
import type { OrganizationApiResult } from "@/lib/dashboard-api/load-organization";

type Ok = Extract<OrganizationApiResult, { ok: true }>;

export function OrganizationDashboardView({ data }: { data: Ok }) {
  const org = data.org;

  return (
    <div className="flex flex-col gap-6">
      <DashboardPanel
        title="Your organization"
        description="Workspace details and subscription plan (for the organization shown below)."
        actions={
          data.showOrgToolbar ? (
            <OrganizationSwitcher
              organizations={data.organizationsForSwitcher}
              currentOrganizationId={org?.organizationId ?? null}
              canCreateOrganization={data.canCreateOrganization}
              canSwitchOrganization={data.canSwitchOrganization}
            />
          ) : undefined
        }
      >
        {org ? (
          <ProfileDetailRows
            rows={[
              { label: "Organization id", value: org.organizationId },
              { label: "Organization name", value: org.organizationName },
              { label: "Plan", value: data.planLabel },
              { label: "Plan limits", value: data.limitsSummary },
            ]}
          />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization linked to your profile yet.
          </p>
        )}
      </DashboardPanel>

      {org ? (
        <OrganizationProjectsPanel
          rows={data.organizationProjectRows}
          canManage={data.canManageProjects}
          canCreateMore={data.projectCapacityOk}
        />
      ) : null}

      {org ? (
        <DashboardPanel
          title="Members"
          description="Active members and pending invitations. Owners can resend or remove invites."
          actions={
            data.canInviteMembers ? (
              <InviteMemberButton
                disabled={!data.inviteMemberPlanOk}
                disabledReason={
                  data.inviteMemberPlanOk
                    ? undefined
                    : (data.inviteMemberPlanError ?? undefined)
                }
              />
            ) : undefined
          }
        >
          {!data.hasAnyRows ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No members in this org.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">User ID</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">
                      Last sign-in / invited
                    </th>
                    {data.canManagePendingInvites ? (
                      <th className="pb-3 font-medium">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                    >
                      <td className="py-3 pr-4 align-top text-zinc-900 dark:text-zinc-100">
                        {m.fullName ?? "—"}
                      </td>
                      <td className="max-w-[12rem] py-3 pr-4 align-top break-all text-zinc-800 dark:text-zinc-200">
                        {m.email ?? "—"}
                      </td>
                      <td className="py-3 pr-4 align-top font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {m.id}
                      </td>
                      <td className="py-3 pr-4 align-top text-zinc-800 dark:text-zinc-200">
                        {m.roleName ?? "—"}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 align-top text-zinc-700 dark:text-zinc-300">
                        {formatDate(m.lastSignIn)}
                      </td>
                      {data.canManagePendingInvites ? (
                        <td className="py-3 align-top text-zinc-400 dark:text-zinc-500">
                          —
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {data.pendingInvites.map((inv) => (
                    <tr
                      key={`invite-${inv.id}`}
                      className="border-b border-zinc-100 bg-zinc-50/60 last:border-0 dark:border-zinc-800 dark:bg-zinc-900/60"
                    >
                      <td className="py-3 pr-4 align-top text-zinc-500 dark:text-zinc-400">
                        —
                      </td>
                      <td className="max-w-[12rem] py-3 pr-4 align-top break-all text-zinc-800 dark:text-zinc-200">
                        {inv.email}
                      </td>
                      <td className="py-3 pr-4 align-top font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        —
                      </td>
                      <td className="py-3 pr-4 align-top text-zinc-800 dark:text-zinc-200">
                        {inv.roleName ?? "—"}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
                          Invited
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap py-3 align-top text-zinc-600 dark:text-zinc-400"
                        title="Invitation sent"
                      >
                        {formatDate(inv.createdAtIso)}
                      </td>
                      {data.canManagePendingInvites ? (
                        <td className="py-3 align-top">
                          <PendingInviteActions inviteId={inv.id} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>
      ) : null}
    </div>
  );
}
