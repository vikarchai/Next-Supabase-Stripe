"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createDealAction, type DealActionState } from "@/actions/deals";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEAL_STATUS_OPTIONS } from "@/components/deals/deal-status";
import { PdfFilePicker } from "@/components/deals/PdfFilePicker";

const initial: DealActionState = { ok: false };

export function DealCreateForm({
  onCreated,
  onCancel,
  dealProjects,
  defaultProjectId,
}: {
  onCreated?: () => void;
  onCancel?: () => void;
  dealProjects: { id: string; name: string }[];
  defaultProjectId: string;
}) {
  const inv = useDashboardCacheInvalidation();
  const [state, formAction, isPending] = useActionState(
    createDealAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [pdfPickerKey, setPdfPickerKey] = useState(0);

  useEffect(() => {
    if (state.ok) {
      toast.success("Deal created.");
      formRef.current?.reset();
      setPdfPickerKey((k) => k + 1);
      inv?.invalidateDeals();
      onCreated?.();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onCreated, inv]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      {dealProjects.length > 0 ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="deal-project">Project</Label>
          <select
            id="deal-project"
            name="project_id"
            defaultValue={defaultProjectId}
            className="flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {dealProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="project_id" value={defaultProjectId} />
      )}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="deal-title">Title</Label>
        <Input
          id="deal-title"
          name="title"
          required
          minLength={2}
          placeholder="e.g. Equipment supply agreement"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="deal-description">Description (optional)</Label>
        <textarea
          id="deal-description"
          name="description"
          rows={3}
          className="flex w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          placeholder="Short summary of the deal"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deal-status">Status</Label>
        <select
          id="deal-status"
          name="status"
          defaultValue="draft"
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
        <Label htmlFor="deal-amount">Amount / note (optional)</Label>
        <Input
          id="deal-amount"
          name="amount_note"
          placeholder="e.g. $500,000"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deal-start">Start date</Label>
        <Input id="deal-start" name="start_at" type="datetime-local" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deal-end">End date</Label>
        <Input id="deal-end" name="end_at" type="datetime-local" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="deal-pdf">Attachment (optional, PDF)</Label>
        <PdfFilePicker key={pdfPickerKey} id="deal-pdf" name="pdf" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Max 20 MB. In Supabase, create a private bucket named{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-200">deal-documents</code> and
          set <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-200">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-200">.env.local</code>.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Create deal"}
        </Button>
      </div>
    </form>
  );
}
