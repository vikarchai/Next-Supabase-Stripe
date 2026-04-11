"use client";

import { useCallback, useState } from "react";

import {
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import { DealDetailPdfLink } from "@/components/deals/DealDetailPdfLink";
import { DealEditPanel } from "@/components/deals/DealEditPanel";
import type { DealStatus } from "@/components/deals/deal-status";
import { Button } from "@/components/ui/button";

export function DealDetailView({
  dealId,
  projectName,
  title,
  statusLabel,
  priceLabel,
  description,
  startLabel,
  endLabel,
  creatorName,
  createdLabel,
  updatedLabel,
  hasPdf,
  pdfFileName,
  status,
  amountNote,
  startAtIso,
  endAtIso,
  canUpdate = false,
}: {
  dealId: string;
  projectName: string;
  title: string;
  statusLabel: string;
  priceLabel: string | null;
  description: string | null;
  startLabel: string;
  endLabel: string;
  creatorName: string;
  createdLabel: string;
  updatedLabel: string;
  hasPdf: boolean;
  pdfFileName: string;
  status: DealStatus;
  amountNote: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  /** `deals:update` */
  canUpdate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const exitEdit = useCallback(() => setEditing(false), []);

  return (
    <DashboardPanel
      title="Deal"
      description={
        editing
          ? "Update fields and save. Cancel discards unsaved form changes."
          : "Summary of this deal. Use Edit to change fields or attachment."
      }
      actions={
        !canUpdate ? null : editing ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={exitEdit}
          >
            Cancel
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )
      }
    >
      {editing ? (
        <DealEditPanel
          dealId={dealId}
          title={title}
          description={description}
          status={status}
          amountNote={amountNote}
          startAtIso={startAtIso}
          endAtIso={endAtIso}
          hasPdf={hasPdf}
          pdfFileName={pdfFileName}
          onSaved={exitEdit}
        />
      ) : (
        <dl className="grid gap-5 text-sm sm:grid-cols-[minmax(8rem,11rem)_1fr] sm:gap-x-8">
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Title</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{title}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Project</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{projectName}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Status</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{statusLabel}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Amount</dt>
          <dd className="tabular-nums text-zinc-900 dark:text-zinc-100">
            {priceLabel ? priceLabel : <span className="text-zinc-400 dark:text-zinc-500">—</span>}
          </dd>

          <dt className="font-medium text-zinc-500 sm:pt-0.5 dark:text-zinc-400">Description</dt>
          <dd className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
            {description?.trim() ? (
              description
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">—</span>
            )}
          </dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Start</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{startLabel}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">End</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{endLabel}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Created by</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{creatorName}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Created</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{createdLabel}</dd>

          <dt className="font-medium text-zinc-500 dark:text-zinc-400">Last updated</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{updatedLabel}</dd>

          <dt className="font-medium text-zinc-500 sm:pt-0.5 dark:text-zinc-400">Attachment</dt>
          <dd>
            {hasPdf ? (
              <DealDetailPdfLink dealId={dealId} fileName={pdfFileName} />
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">No file</span>
            )}
          </dd>
        </dl>
      )}
    </DashboardPanel>
  );
}
