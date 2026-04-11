import Link from "next/link";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  dealStatusLabel,
  type DealStatus,
} from "@/components/deals/deal-status";
import {
  DashboardPageShell,
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import { getViewer } from "@/lib/auth/viewer";
import {
  getAnalyticsCreatedAtGte,
  getOrganizationPlanSlug,
} from "@/lib/billing/plan-enforcement";
import { getPlanDefinitionBySlug } from "@/lib/billing/plan-limits";
import {
  PERM_DEALS_READ,
  getPermissionCodesForUser,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getDb } from "@/db";
import { deals, profiles } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS_ORDER: DealStatus[] = [
  "draft",
  "negotiation",
  "won",
  "lost",
  "archived",
];

function formatShortDate(value: Date | null | undefined): string {
  if (!value) return "—";
  try {
    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

async function DashboardPageData() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <DashboardPanel title="Session" description="You are not signed in.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Not authenticated.</p>
      </DashboardPanel>
    );
  }

  const organizationId = viewer.profile?.organizationId;
  if (!organizationId) {
    return (
      <DashboardPanel
        title="Dashboard"
        description="Deals overview for your workspace."
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No organization linked to your profile yet. Finish onboarding to
          see deal stats.
        </p>
      </DashboardPanel>
    );
  }

  const permissionCodes = await getPermissionCodesForUser(viewer.user.id);
  if (!permissionCodes.has(PERM_DEALS_READ)) {
    return (
      <DashboardPanel
        title="Dashboard"
        description="Workspace home."
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You don’t have permission to see deal statistics (deals:read). Ask
          an administrator to update your role if you need access.
        </p>
      </DashboardPanel>
    );
  }

  const db = getDb();
  const dealMember = alias(profiles, "deal_member");
  const analyticsCutoff = await getAnalyticsCreatedAtGte(organizationId);
  const planSlug = await getOrganizationPlanSlug(organizationId);
  const analyticsDays = getPlanDefinitionBySlug(planSlug).limits.analyticsDays;
  const memberScope = and(
    eq(dealMember.id, viewer.user.id),
    eq(dealMember.organization_id, deals.organization_id),
    ...(analyticsCutoff ? [gte(deals.created_at, analyticsCutoff)] : []),
  );

  const statusRows = await db
    .select({
      status: deals.status,
      n: count(),
    })
    .from(deals)
    .innerJoin(dealMember, memberScope)
    .groupBy(deals.status);
  const recentRows = await db
    .select({
      id: deals.id,
      title: deals.title,
      status: deals.status,
      created_at: deals.created_at,
      amount_note: deals.amount_note,
    })
    .from(deals)
    .innerJoin(dealMember, memberScope)
    .orderBy(desc(deals.created_at))
    .limit(8);

  const countByStatus = new Map<DealStatus, number>();
  for (const row of statusRows) {
    countByStatus.set(row.status, Number(row.n));
  }
  const total = [...countByStatus.values()].reduce((a, b) => a + b, 0);
  const pipeline =
    (countByStatus.get("draft") ?? 0) +
    (countByStatus.get("negotiation") ?? 0);
  const won = countByStatus.get("won") ?? 0;
  const closed =
    (countByStatus.get("lost") ?? 0) + (countByStatus.get("archived") ?? 0);

  const linkOutlineSm = cn(
    "inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  );
  const linkGhostSm = cn(
    "inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-100 dark:hover:bg-zinc-800",
  );
  const linkPrimarySm = cn(
    "inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  );

  const analyticsHint =
    analyticsCutoff == null
      ? "In your organization"
      : `Last ${analyticsDays} days (plan limit)`;

  const statTiles = [
    { label: "All deals", value: total, hint: analyticsHint },
    { label: "Pipeline", value: pipeline, hint: "Draft + negotiation" },
    { label: "Won", value: won, hint: "Closed won" },
    { label: "Closed out", value: closed, hint: "Lost + archived" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DashboardPanel
        title="Deals overview"
        description={
          analyticsCutoff == null
            ? "Counts and recent activity from your deals table."
            : `Counts and activity from the last ${analyticsDays} days (your plan).`
        }
        actions={
          <Link href="/deals" className={linkOutlineSm}>
            Open deals
          </Link>
        }
      >
        {total === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No deals yet</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Create the first deal to populate this dashboard.
            </p>
            <Link href="/deals" className={cn(linkPrimarySm, "mt-4")}>
              Go to Deals
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statTiles.map((t) => (
                <div
                  key={t.label}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {t.value}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.hint}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                By status
              </h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((st) => {
                  const n = countByStatus.get(st) ?? 0;
                  return (
                    <div
                      key={st}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {dealStatusLabel(st)}
                      </span>
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {n}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel
        title="Recent deals"
        description={
          analyticsCutoff == null
            ? "Latest updates in your organization."
            : `Latest updates in the last ${analyticsDays} days.`
        }
        actions={
          total > 0 ? (
            <Link href="/deals" className={linkGhostSm}>
              View all
            </Link>
          ) : null
        }
      >
        {recentRows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing to show yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Deal</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="py-2.5 pr-4 align-top">
                      <Link
                        href={`/deals/${d.id}`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 align-top text-zinc-700 dark:text-zinc-300">
                      {dealStatusLabel(d.status)}
                    </td>
                    <td className="max-w-[10rem] py-2.5 pr-4 align-top text-zinc-600 dark:text-zinc-400">
                      {d.amount_note?.trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 align-top text-zinc-600 dark:text-zinc-400">
                      {formatShortDate(d.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardPageShell title="Dashboard">
      <DashboardPageData />
    </DashboardPageShell>
  );
}
