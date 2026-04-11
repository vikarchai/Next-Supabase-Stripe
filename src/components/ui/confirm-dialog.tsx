"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Danger styling for destructive actions (delete, revoke). */
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  isPending?: boolean;
};

/**
 * Native `<dialog>` confirmation (no `alert` / `confirm`).
 * Use a high z-index so it stacks above other modals.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "neutral",
  onConfirm,
  isPending = false,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.showModal();
    else if (el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      className={cn(
        "fixed left-[50vw] top-[50vh] z-[200] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-0 shadow-xl",
        "[&::backdrop]:bg-black/50",
      )}
    >
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {description ? (
          <div className="mt-2 text-sm leading-relaxed text-zinc-600">
            {description}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          className={
            tone === "danger"
              ? "bg-red-600 text-white hover:bg-red-700"
              : undefined
          }
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {isPending ? "…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
