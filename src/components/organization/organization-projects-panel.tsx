"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createProjectAction,
  renameProjectAction,
  type ProjectActionState,
} from "@/actions/projects";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { DashboardPanel } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initial: ProjectActionState = { ok: false };

export type OrganizationProjectRow = {
  id: string;
  name: string;
  isDefault: boolean;
  dealCount: number;
  createdAtLabel: string;
};

function CreateProjectDialog() {
  const inv = useDashboardCacheInvalidation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectAction, initial);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Project created.");
      close();
      inv?.invalidateDeals();
      inv?.invalidateOrganization();
      router.refresh();
    } else if (state.error) toast.error(state.error);
  }, [state, close, router, inv]);

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
        New project
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className={cn(
          "fixed left-[50vw] top-[50vh] z-[100] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
          "[&::backdrop]:bg-black/50",
        )}
      >
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            New project
          </h2>
        </div>
        <form action={formAction} className="space-y-3 p-4">
          <Input
            key={open ? "open" : "closed"}
            name="name"
            required
            minLength={1}
            maxLength={120}
            placeholder="Project name"
            autoComplete="off"
            aria-label="Project name"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function RenameProjectDialog({
  project,
  onClose,
}: {
  project: { id: string; name: string };
  onClose: () => void;
}) {
  const inv = useDashboardCacheInvalidation();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(renameProjectAction, initial);

  // showModal after ref attaches; never call close() in cleanup — it fires `close` and
  // `onClose`, which clears parent state (worse under React Strict Mode double-mount).
  useLayoutEffect(() => {
    dialogRef.current?.showModal();
  }, [project.id]);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Renamed.");
      onClose();
      inv?.invalidateDeals();
      inv?.invalidateOrganization();
      router.refresh();
    } else if (state.error) toast.error(state.error);
  }, [state, onClose, router, inv]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        "fixed left-[50vw] top-[50vh] z-[100] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
        "[&::backdrop]:bg-black/50",
      )}
    >
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Rename project
        </h2>
      </div>
      <form action={formAction} className="space-y-3 p-4">
        <input type="hidden" name="project_id" value={project.id} />
        <Input
          key={project.id}
          name="name"
          required
          minLength={1}
          maxLength={120}
          defaultValue={project.name}
          autoComplete="off"
          aria-label="Project name"
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function OrganizationProjectsPanel({
  rows,
  canManage,
  canCreateMore,
}: {
  rows: OrganizationProjectRow[];
  canManage: boolean;
  canCreateMore: boolean;
}) {
  const [renaming, setRenaming] = useState<OrganizationProjectRow | null>(null);

  return (
    <>
      <DashboardPanel
        title="Projects"
        actions={
          canManage && canCreateMore ? <CreateProjectDialog /> : undefined
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No projects.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium text-right">Deals</th>
                  <th className="pb-3 pr-4 font-medium">Created</th>
                  {canManage ? (
                    <th className="pb-3 font-medium">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="py-3 pr-4 align-top text-zinc-900 dark:text-zinc-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        {row.isDefault ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                            Default
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                      {row.dealCount}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 align-top text-zinc-700 dark:text-zinc-300">
                      {row.createdAtLabel}
                    </td>
                    {canManage ? (
                      <td className="py-3 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setRenaming(row)}
                        >
                          Rename
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
      {renaming ? (
        <RenameProjectDialog
          key={renaming.id}
          project={{ id: renaming.id, name: renaming.name }}
          onClose={() => setRenaming(null)}
        />
      ) : null}
    </>
  );
}
