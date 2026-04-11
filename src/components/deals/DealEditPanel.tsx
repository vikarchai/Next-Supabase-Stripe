"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import {
  replaceDealPdfAction,
  updateDealFieldsAction,
  type DealActionState,
} from "@/actions/deals";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { DealDetailPdfLink } from "@/components/deals/DealDetailPdfLink";
import { DEAL_STATUS_OPTIONS, type DealStatus } from "@/components/deals/deal-status";
import { PdfFilePicker } from "@/components/deals/PdfFilePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isoToDatetimeLocalValue } from "@/lib/deals/datetime-local";

const initial: DealActionState = { ok: false };

export function DealEditPanel({
  dealId,
  title,
  description,
  status,
  amountNote,
  startAtIso,
  endAtIso,
  hasPdf,
  pdfFileName,
  onSaved,
}: {
  dealId: string;
  title: string;
  description: string | null;
  status: DealStatus;
  amountNote: string | null;
  startAtIso: string | null;
  endAtIso: string | null;
  hasPdf: boolean;
  pdfFileName: string;
  /** Close edit mode after a successful save or PDF upload. */
  onSaved?: () => void;
}) {
  const inv = useDashboardCacheInvalidation();
  const router = useRouter();
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");

  useEffect(() => {
    setStartLocal(isoToDatetimeLocalValue(startAtIso));
    setEndLocal(isoToDatetimeLocalValue(endAtIso));
  }, [startAtIso, endAtIso]);

  const [fieldState, fieldAction, fieldPending] = useActionState(
    updateDealFieldsAction,
    initial,
  );

  const [pdfPickerKey, setPdfPickerKey] = useState(0);
  const [pdfState, pdfAction, pdfPending] = useActionState(
    replaceDealPdfAction,
    initial,
  );

  useEffect(() => {
    if (fieldState.ok) {
      toast.success("Deal saved.");
      inv?.invalidateDeals();
      flushSync(() => {
        onSaved?.();
      });
      router.refresh();
    } else if (fieldState.error) toast.error(fieldState.error);
  }, [fieldState, router, onSaved, inv]);

  useEffect(() => {
    if (pdfState.ok) {
      toast.success(hasPdf ? "File replaced." : "File attached.");
      setPdfPickerKey((k) => k + 1);
      inv?.invalidateDeals();
      flushSync(() => {
        onSaved?.();
      });
      router.refresh();
    } else if (pdfState.error) toast.error(pdfState.error);
  }, [pdfState, router, hasPdf, onSaved, inv]);

  return (
    <div className="space-y-8">
      <form
        action={fieldAction}
        className="grid gap-4 sm:grid-cols-2"
      >
        <input type="hidden" name="deal_id" value={dealId} />

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`edit-title-${dealId}`}>Title</Label>
          <Input
            id={`edit-title-${dealId}`}
            name="title"
            required
            minLength={2}
            defaultValue={title}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`edit-desc-${dealId}`}>Description (optional)</Label>
          <textarea
            id={`edit-desc-${dealId}`}
            name="description"
            rows={4}
            defaultValue={description ?? ""}
            className="flex w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`edit-status-${dealId}`}>Status</Label>
          <select
            id={`edit-status-${dealId}`}
            name="status"
            defaultValue={status}
            className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {DEAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`edit-amount-${dealId}`}>Amount / note (optional)</Label>
          <Input
            id={`edit-amount-${dealId}`}
            name="amount_note"
            defaultValue={amountNote ?? ""}
            placeholder="e.g. 500000 or 500.50"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`edit-start-${dealId}`}>Start date</Label>
          <Input
            id={`edit-start-${dealId}`}
            name="start_at"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`edit-end-${dealId}`}>End date</Label>
          <Input
            id={`edit-end-${dealId}`}
            name="end_at"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={fieldPending}>
            {fieldPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Attachment</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Files are stored under a random name. Pick a file to attach or replace
          the current one.
        </p>
        {hasPdf ? (
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            Current file:{" "}
            <DealDetailPdfLink dealId={dealId} fileName={pdfFileName} />
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No file attached.</p>
        )}
        <form action={pdfAction} noValidate className="mt-3 inline">
          <input type="hidden" name="deal_id" value={dealId} />
          <PdfFilePicker
            key={pdfPickerKey}
            name="pdf"
            compact
            submitOnSelect
            disabled={pdfPending}
            chooseFileLabel={hasPdf ? "Replace file" : "Add file"}
          />
        </form>
      </div>
    </div>
  );
}
