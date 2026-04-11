"use client";

import { useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";

import { DealCreateDialog } from "@/components/deals/DealCreateDialog";
import { DealsKanban } from "@/components/deals/DealsKanban";
import { DealsProjectBar } from "@/components/deals/DealsProjectBar";
import { DealsTable, type DealTableRow } from "@/components/deals/DealsTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DealsView = "table" | "kanban";

export function DealsPageContent({
  rows,
  canCreateDeal,
  createDealBlockedReason,
  canUpdateDeal,
  canDeleteDeal,
  dealProjects,
  defaultProjectId,
  projectFilterId,
  projectScopeDescription,
}: {
  rows: DealTableRow[];
  canCreateDeal: boolean;
  /** Shown when user has deals:create but plan cap reached. */
  createDealBlockedReason?: string | null;
  canUpdateDeal: boolean;
  canDeleteDeal: boolean;
  dealProjects: { id: string; name: string }[];
  defaultProjectId: string;
  projectFilterId: "all" | string;
  /** Short line under the title (e.g. filtered scope). */
  projectScopeDescription: string | null;
}) {
  const [view, setView] = useState<DealsView>("table");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>All deals</CardTitle>
            <CardDescription>
              {projectScopeDescription ?? "For your organization."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
              role="group"
              aria-label="Deals view"
            >
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-8 gap-1.5 px-2.5 text-xs",
                  view === "table" &&
                    "bg-white text-zinc-900 shadow-sm hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden />
                Table
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-8 gap-1.5 px-2.5 text-xs",
                  view === "kanban" &&
                    "bg-white text-zinc-900 shadow-sm hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
                onClick={() => setView("kanban")}
                aria-pressed={view === "kanban"}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                Board
              </Button>
            </div>
            {canCreateDeal || createDealBlockedReason ? (
              <DealCreateDialog
                disabled={Boolean(createDealBlockedReason)}
                disabledReason={createDealBlockedReason ?? undefined}
                dealProjects={dealProjects}
                defaultProjectId={defaultProjectId}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {dealProjects.length > 1 ? (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <DealsProjectBar
              projects={dealProjects}
              activeProjectId={projectFilterId}
            />
            {projectFilterId === "all" ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Showing every project. Use the chips to focus one project.
              </p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Only deals in the selected project are listed.
              </p>
            )}
          </div>
        ) : null}
        {view === "table" ? (
          <DealsTable
            rows={rows}
            canCreateDeal={canCreateDeal}
            canUpdateDeal={canUpdateDeal}
            canDeleteDeal={canDeleteDeal}
          />
        ) : (
          <DealsKanban
            rows={rows}
            canUpdateDeal={canUpdateDeal}
            canCreateDeal={canCreateDeal}
          />
        )}
      </CardContent>
    </Card>
  );
}
