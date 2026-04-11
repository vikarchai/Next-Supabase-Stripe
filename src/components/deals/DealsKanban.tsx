"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { updateDealStatusAction, type DealActionState } from "@/actions/deals";
import { DEAL_STATUS_OPTIONS, type DealStatus } from "@/components/deals/deal-status";
import type { DealTableRow } from "@/components/deals/DealsTable";
import { formatDealPriceDisplay } from "@/lib/deals/format-price";
import { formatDealTermRange } from "@/lib/deals/format-window";
import { cn } from "@/lib/utils";

const DND_TYPE = "application/x-template-vercel-deal-id";

const actionInitial: DealActionState = { ok: false };

function DealKanbanCard({
  row,
  draggable,
}: {
  row: DealTableRow;
  draggable: boolean;
}) {
  const priceLabel = formatDealPriceDisplay(row.amountNote);
  const term = formatDealTermRange(row.startAtIso, row.endAtIso);

  return (
    <div
      draggable={draggable}
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        draggable &&
          "cursor-grab active:cursor-grabbing",
      )}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData(DND_TYPE, row.id);
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
    >
      <Link
        href={`/deals/${row.id}`}
        draggable={false}
        className="block font-medium leading-snug text-zinc-900 hover:underline dark:text-zinc-100"
      >
        {row.title}
      </Link>
      {priceLabel ? (
        <p className="mt-1.5 text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
          {priceLabel}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{term}</p>
    </div>
  );
}

export function DealsKanban({
  rows,
  canUpdateDeal = false,
  canCreateDeal = false,
}: {
  rows: DealTableRow[];
  canUpdateDeal?: boolean;
  canCreateDeal?: boolean;
}) {
  const router = useRouter();
  const dndActive = canUpdateDeal;
  const [items, setItems] = useState(rows);
  const [overStatus, setOverStatus] = useState<DealStatus | null>(null);
  const [, startTransition] = useTransition();
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    setItems(rows);
  }, [rows]);

  useEffect(() => {
    const clearOver = () => setOverStatus(null);
    document.addEventListener("dragend", clearOver);
    return () => document.removeEventListener("dragend", clearOver);
  }, []);

  const byStatus = useMemo(() => {
    const map = new Map<DealStatus, DealTableRow[]>();
    for (const o of DEAL_STATUS_OPTIONS) {
      map.set(o.value, []);
    }
    for (const row of items) {
      const list = map.get(row.status);
      if (list) list.push(row);
    }
    return map;
  }, [items]);

  const moveDeal = useCallback((dealId: string, newStatus: DealStatus) => {
    setItems((prev) =>
      prev.map((r) => (r.id === dealId ? { ...r, status: newStatus } : r)),
    );
    startTransition(async () => {
      const fd = new FormData();
      fd.set("deal_id", dealId);
      fd.set("status", newStatus);
      const r = await updateDealStatusAction(actionInitial, fd);
      if (!r.ok) {
        setItems(rowsRef.current);
        if (r.error) toast.error(r.error);
        return;
      }
      toast.success("Status updated.");
      router.refresh();
    });
  }, [router]);

  const onDropOnColumn = useCallback(
    (e: React.DragEvent, columnStatus: DealStatus) => {
      e.preventDefault();
      setOverStatus(null);
      const dealId = e.dataTransfer.getData(DND_TYPE);
      if (!dealId) return;
      const row = items.find((r) => r.id === dealId);
      if (!row || row.status === columnStatus) return;
      moveDeal(dealId, columnStatus);
    },
    [items, moveDeal],
  );

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
    <div className="flex flex-col gap-2">
      {!canUpdateDeal ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          You don’t have permission to move deals on the board. Open a deal to
          change status if your role allows it.
        </p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2">
      {DEAL_STATUS_OPTIONS.map(({ value: status, label }) => {
        const columnRows = byStatus.get(status) ?? [];
        const isOver = overStatus === status;
        return (
          <div
            key={status}
            className="flex w-[min(100%,280px)] min-w-[200px] shrink-0 flex-col rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/70"
            onDragOver={
              dndActive
                ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setOverStatus(status);
                  }
                : undefined
            }
            onDragLeave={
              dndActive
                ? (e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setOverStatus(null);
                    }
                  }
                : undefined
            }
            onDrop={dndActive ? (e) => onDropOnColumn(e, status) : undefined}
          >
            <div className="border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {label}
              </h3>
              <p className="text-[0.65rem] text-zinc-400 dark:text-zinc-500">{columnRows.length}</p>
            </div>
            <div
              className={cn(
                "flex min-h-[120px] flex-1 flex-col gap-2 p-2 transition-colors",
                isOver && "bg-sky-50/90 ring-1 ring-inset ring-sky-200/80 dark:bg-sky-950/30 dark:ring-sky-700/80",
              )}
            >
              {columnRows.map((row) => (
                <DealKanbanCard
                  key={row.id}
                  row={row}
                  draggable={dndActive}
                />
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
