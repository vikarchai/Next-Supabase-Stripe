"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteDealAction,
  getDealPdfSignedUrlAction,
  replaceDealPdfAction,
  updateDealStatusAction,
  type DealActionState,
} from "@/actions/deals";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PdfFilePicker } from "@/components/deals/PdfFilePicker";
import {
  dealStatusLabel,
  nextDealStatus,
  type DealStatus,
} from "@/components/deals/deal-status";
import { formatDealPriceDisplay } from "@/lib/deals/format-price";
import { formatDealTermRange } from "@/lib/deals/format-window";

export type DealTableRow = {
  id: string;
  title: string;
  description: string | null;
  status: DealStatus;
  startAtIso: string | null;
  endAtIso: string | null;
  amountNote: string | null;
  creatorName: string;
  createdAtLabel: string;
  pdfOriginalName: string | null;
  hasPdf: boolean;
  projectName: string;
};

const actionInitial: DealActionState = { ok: false };

function shouldIgnoreRowNavigation(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "button, a, input, select, textarea, label, dialog, form, [data-stop-row-nav]",
    ),
  );
}

function StatusForm({
  dealId,
  status,
  canAdvance,
}: {
  dealId: string;
  status: DealStatus;
  canAdvance: boolean;
}) {
  const inv = useDashboardCacheInvalidation();
  const [state, formAction, pending] = useActionState(
    updateDealStatusAction,
    actionInitial,
  );
  const nextStatus = nextDealStatus(status);

  useEffect(() => {
    if (state.ok) {
      toast.success("Status updated.");
      inv?.invalidateDeals();
    } else if (state.error) toast.error(state.error);
  }, [state, inv]);

  if (!canAdvance) {
    return (
      <span className="inline-flex h-8 max-w-full items-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        <span className="min-w-0 truncate">{dealStatusLabel(status)}</span>
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex max-w-full">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="h-8 max-w-full gap-1 px-2.5 text-xs font-medium"
        title={`Next: ${dealStatusLabel(nextStatus)}`}
        aria-label={`${dealStatusLabel(status)} — advance to ${dealStatusLabel(nextStatus)}`}
      >
        <span className="min-w-0 truncate">{dealStatusLabel(status)}</span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
    </form>
  );
}

function PdfAddForm({ dealId }: { dealId: string }) {
  const inv = useDashboardCacheInvalidation();
  const [pickerKey, setPickerKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    replaceDealPdfAction,
    actionInitial,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("File attached.");
      setPickerKey((k) => k + 1);
      inv?.invalidateDeals();
    } else if (state.error) toast.error(state.error);
  }, [state, inv]);

  return (
    <form action={formAction} noValidate className="inline">
      <input type="hidden" name="deal_id" value={dealId} />
      <PdfFilePicker
        key={pickerKey}
        name="pdf"
        compact
        submitOnSelect
        disabled={pending}
        chooseFileLabel="Add file"
      />
    </form>
  );
}

function PdfFileNameLink({
  dealId,
  fileName,
}: {
  dealId: string;
  fileName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title={fileName}
      className="max-w-full cursor-pointer truncate text-left text-xs font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950 hover:decoration-zinc-500 disabled:opacity-60 dark:text-zinc-200 dark:decoration-zinc-600 dark:hover:text-zinc-50 dark:hover:decoration-zinc-300"
      onClick={() => {
        startTransition(async () => {
          const r = await getDealPdfSignedUrlAction(dealId);
          if (r.ok) {
            window.open(r.url, "_blank", "noopener,noreferrer");
          } else {
            toast.error(r.error);
          }
        });
      }}
    >
      {fileName}
    </button>
  );
}

function DeleteDealButton({
  dealId,
  title,
  canDelete,
}: {
  dealId: string;
  title: string;
  canDelete: boolean;
}) {
  const inv = useDashboardCacheInvalidation();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canDelete) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this deal?"
        description={
          <>
            This will remove “{title}” and any file in storage.
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        isPending={pending}
        onConfirm={() => {
          const fd = new FormData();
          fd.set("deal_id", dealId);
          startTransition(async () => {
            const r = await deleteDealAction(actionInitial, fd);
            if (r.ok) {
              toast.success("Deal deleted.");
              inv?.invalidateDeals();
            } else if (r.error) toast.error(r.error);
          });
        }}
      />
    </>
  );
}

export function DealsTable({
  rows,
  canUpdateDeal = false,
  canDeleteDeal = false,
  canCreateDeal = false,
}: {
  rows: DealTableRow[];
  canUpdateDeal?: boolean;
  canDeleteDeal?: boolean;
  canCreateDeal?: boolean;
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No deals yet
        {canCreateDeal ? (
          <>
            {" "}
            — click <span className="font-medium">New deal</span> to add one.
          </>
        ) : (
          ". Ask an admin if you need access to create deals."
        )}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="pb-3 pr-4 font-medium">Deal</th>
            <th className="pb-3 pr-4 font-medium">Project</th>
            <th className="pb-3 pr-4 font-medium">Amount</th>
            <th className="pb-3 pr-4 font-medium">Description</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Term</th>
            <th className="pb-3 pr-4 font-medium">Created</th>
            <th className="pb-3 pr-4 font-medium">Attachment</th>
            <th className="pb-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const priceLabel = formatDealPriceDisplay(row.amountNote);
            return (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-zinc-100 last:border-0 dark:border-zinc-800"
              onClick={(e) => {
                if (shouldIgnoreRowNavigation(e.target)) return;
                router.push(`/deals/${row.id}`);
              }}
            >
              <td className="py-3 pr-4 align-top font-medium text-zinc-900 dark:text-zinc-100">
                {row.title}
              </td>
              <td className="py-3 pr-4 align-top text-zinc-800 dark:text-zinc-200">
                <span className="line-clamp-2 text-xs">{row.projectName}</span>
              </td>
              <td className="py-3 pr-4 align-top text-sm font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                {priceLabel ? (
                  <span className="break-words">{priceLabel}</span>
                ) : (
                  <span className="font-normal text-zinc-400 dark:text-zinc-500">—</span>
                )}
              </td>
              <td className="max-w-[14rem] py-3 pr-4 align-top break-words text-zinc-800 dark:text-zinc-200">
                {row.description ? (
                  <p
                    className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
                    title={row.description}
                  >
                    {row.description}
                  </p>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">—</span>
                )}
              </td>
              <td className="py-3 pr-4 align-top" data-stop-row-nav>
                <StatusForm
                  dealId={row.id}
                  status={row.status}
                  canAdvance={canUpdateDeal}
                />
              </td>
              <td className="py-3 pr-4 align-top whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                <span className="text-xs leading-snug">
                  {formatDealTermRange(row.startAtIso, row.endAtIso)}
                </span>
              </td>
              <td className="py-3 pr-4 align-top text-zinc-800 dark:text-zinc-200">
                <div className="text-sm">{row.creatorName}</div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {row.createdAtLabel}
                </div>
              </td>
              <td className="py-3 pr-4 align-top" data-stop-row-nav>
                <div className="min-w-0">
                  {row.hasPdf ? (
                    <PdfFileNameLink
                      dealId={row.id}
                      fileName={row.pdfOriginalName ?? "document.pdf"}
                    />
                  ) : canUpdateDeal ? (
                    <PdfAddForm dealId={row.id} />
                  ) : (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                  )}
                </div>
              </td>
              <td className="py-3 align-top text-zinc-400 dark:text-zinc-500" data-stop-row-nav>
                {canDeleteDeal ? (
                  <DeleteDealButton
                    dealId={row.id}
                    title={row.title}
                    canDelete
                  />
                ) : (
                  "—"
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
