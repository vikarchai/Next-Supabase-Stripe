import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageShell } from "@/components/layout/dashboard-shell";
import { DealDetailView } from "@/components/deals/DealDetailView";
import { dealStatusLabel } from "@/components/deals/deal-status";
import { getViewer } from "@/lib/auth/viewer";
import {
  PERM_DEALS_READ,
  PERM_DEALS_UPDATE,
  getPermissionCodesForUser,
} from "@/lib/permissions";
import { formatDealPriceDisplay } from "@/lib/deals/format-price";
import { getDb } from "@/db";
import { deals, profiles, projects } from "@/db/schema";

export const dynamic = "force-dynamic";

function formatDetailDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  try {
    return value.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function DealDetailPage({ params }: PageProps) {
  const { id: dealId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(dealId)) {
    notFound();
  }

  const viewer = await getViewer();
  if (!viewer) {
    return (
      <DashboardPageShell title="Deal">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Not authenticated.</p>
      </DashboardPageShell>
    );
  }

  const organizationId = viewer.profile?.organizationId;
  if (!organizationId) {
    notFound();
  }

  const permissionCodes = await getPermissionCodesForUser(viewer.user.id);
  if (!permissionCodes.has(PERM_DEALS_READ)) {
    notFound();
  }
  const canUpdateDeal = permissionCodes.has(PERM_DEALS_UPDATE);

  const db = getDb();
  const dealProject = alias(projects, "deal_project");
  const rows = await db
    .select({
      deal: deals,
      creatorName: profiles.full_name,
      projectName: dealProject.name,
    })
    .from(deals)
    .innerJoin(profiles, eq(deals.created_by, profiles.id))
    .innerJoin(dealProject, eq(deals.project_id, dealProject.id))
    .where(
      and(eq(deals.id, dealId), eq(deals.organization_id, organizationId)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    notFound();
  }

  const { deal, creatorName, projectName } = row;
  const price = formatDealPriceDisplay(deal.amount_note);
  const hasPdf = Boolean(deal.pdf_storage_path);
  const pdfName = deal.pdf_original_name ?? "document.pdf";

  return (
    <DashboardPageShell title={deal.title}>
      <p className="mb-4 text-sm">
        <Link
          href="/deals"
          className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-100"
        >
          ← All deals
        </Link>
      </p>

      <DealDetailView
        key={deal.updated_at.toISOString()}
        dealId={deal.id}
        projectName={projectName}
        title={deal.title}
        statusLabel={dealStatusLabel(deal.status)}
        priceLabel={price}
        description={deal.description}
        startLabel={formatDetailDateTime(deal.start_at)}
        endLabel={formatDetailDateTime(deal.end_at)}
        creatorName={creatorName}
        createdLabel={formatDetailDateTime(deal.created_at)}
        updatedLabel={formatDetailDateTime(deal.updated_at)}
        hasPdf={hasPdf}
        pdfFileName={pdfName}
        status={deal.status}
        amountNote={deal.amount_note}
        startAtIso={deal.start_at ? deal.start_at.toISOString() : null}
        endAtIso={deal.end_at ? deal.end_at.toISOString() : null}
        canUpdate={canUpdateDeal}
      />
    </DashboardPageShell>
  );
}
