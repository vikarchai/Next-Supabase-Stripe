"use client";

import { useCallback, useRef, useState } from "react";

import { DealCreateForm } from "@/components/deals/DealCreateForm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DealCreateDialog({
  disabled = false,
  disabledReason,
  dealProjects,
  defaultProjectId,
}: {
  disabled?: boolean;
  disabledReason?: string;
  dealProjects: { id: string; name: string }[];
  defaultProjectId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
  }, []);

  if (disabled) {
    return (
      <Button
        type="button"
        size="sm"
        disabled
        title={disabledReason}
        aria-label={disabledReason ?? "Cannot create deal"}
      >
        New deal
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
      >
        New deal
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className={cn(
          "fixed left-[50vw] top-[50vh] z-[100] max-h-[min(90vh,720px)] w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-0 shadow-xl sm:w-[min(100vw-2rem,40rem)] dark:border-zinc-800 dark:bg-zinc-900",
          "[&::backdrop]:bg-black/50",
        )}
      >
        <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">New deal</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Title, dates, status, and an optional attachment (counts toward storage).
          </p>
        </div>
        <div className="p-4">
          <DealCreateForm
            key={open ? "open" : "closed"}
            onCreated={close}
            onCancel={close}
            dealProjects={dealProjects}
            defaultProjectId={defaultProjectId}
          />
        </div>
      </dialog>
    </>
  );
}
