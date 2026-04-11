"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync, useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  deleteRoleAction,
  saveRoleModalAction,
  type RoleActionState,
} from "@/actions/roles";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type OrgRoleListItem = {
  id: string;
  name: string;
  slug: string | null;
  is_system: boolean;
  permissionCodes: string[];
  permissionIds: string[];
};

export type CatalogPermission = {
  id: string;
  code: string;
  description: string | null;
};

function isRoleRemovable(r: OrgRoleListItem): boolean {
  if (r.slug === "owner" || r.slug === "admin") return false;
  if (r.is_system) return false;
  return true;
}

function roleUsesSystemChrome(r: OrgRoleListItem): boolean {
  return r.is_system && r.slug !== "owner";
}

function showSystemBadge(r: OrgRoleListItem): boolean {
  return r.is_system && r.slug !== "owner";
}

function SaveSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function useRoleToasts(
  saveState: RoleActionState,
  delState: RoleActionState,
  onSuccess: () => void,
) {
  const saveErrShown = useRef<string | undefined>(undefined);
  const delErrShown = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    if (saveState?.ok && saveState.message) {
      saveErrShown.current = undefined;
      toast.success(saveState.message);
      onSuccess();
    }
  }, [saveState, onSuccess]);

  useLayoutEffect(() => {
    if (delState?.ok && delState.message) {
      delErrShown.current = undefined;
      toast.success(delState.message);
      onSuccess();
    }
  }, [delState, onSuccess]);

  useEffect(() => {
    if (
      saveState?.error &&
      saveState.error !== saveErrShown.current
    ) {
      saveErrShown.current = saveState.error;
      toast.error(saveState.error);
    }
  }, [saveState?.error]);

  useEffect(() => {
    if (delState?.error && delState.error !== delErrShown.current) {
      delErrShown.current = delState.error;
      toast.error(delState.error);
    }
  }, [delState?.error]);
}

export function OrganizationRolesCard({
  description,
  roles,
  catalogPermissions,
  allowCreateRole = false,
  allowEditRoles = false,
  allowDeleteRoles = false,
  allowRenameRole = false,
}: {
  description?: string;
  roles: OrgRoleListItem[];
  catalogPermissions: CatalogPermission[];
  /** `roles:manage` */
  allowCreateRole?: boolean;
  /** `roles:manage` or `permissions:assign` */
  allowEditRoles?: boolean;
  /** `roles:manage` */
  allowDeleteRoles?: boolean;
  /** `roles:manage` (custom role names) */
  allowRenameRole?: boolean;
}) {
  const inv = useDashboardCacheInvalidation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<null | "create" | OrgRoleListItem>(null);

  const initial: RoleActionState = { ok: false };
  const [saveState, saveAction] = useActionState(saveRoleModalAction, initial);
  const [delState, delAction, isDeletePending] = useActionState(
    deleteRoleAction,
    initial,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const closeModal = useCallback(() => {
    setDraft(null);
  }, []);

  const onRoleMutationSuccess = useCallback(() => {
    closeModal();
    inv?.invalidateRoles();
    inv?.invalidateOrganization();
  }, [closeModal, inv]);

  useRoleToasts(saveState, delState, onRoleMutationSuccess);

  useEffect(() => {
    setDeleteConfirmOpen(false);
  }, [draft]);

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el || draft !== null) return;
    el.close();
  }, [draft]);

  const isCreate = draft === "create";
  const editingRole = draft !== null && draft !== "create" ? draft : null;
  const systemNameLocked = editingRole?.is_system ?? false;
  const nameLockedForUser =
    systemNameLocked || (Boolean(editingRole) && !allowRenameRole);

  const formKey = isCreate ? "create" : editingRole?.id ?? "none";

  const selectedPermissionIds =
    isCreate || !editingRole
      ? new Set<string>()
      : new Set(editingRole.permissionIds);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle>Organization roles</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {allowCreateRole ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => {
                flushSync(() => setDraft("create"));
                dialogRef.current?.showModal();
              }}
            >
              Create role
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No roles in this org.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {roles.map((role) => (
              <li
                key={role.id}
                className={cn(
                  "flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                  roleUsesSystemChrome(role) &&
                    "-mx-2 rounded-lg border border-amber-200/80 bg-amber-50/25 px-3 py-4 first:mt-0 dark:border-amber-900/60 dark:bg-amber-950/20",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {role.name}
                    </span>
                    {showSystemBadge(role) ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                        System
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {role.permissionCodes.length === 0 ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        No permissions
                      </span>
                    ) : (
                      role.permissionCodes.map((code) => (
                        <span
                          key={code}
                          className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          {code}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                {allowEditRoles ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start"
                    onClick={() => {
                      flushSync(() => setDraft(role));
                      dialogRef.current?.showModal();
                    }}
                  >
                    Edit
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <dialog
          ref={dialogRef}
          onClose={() => setDraft(null)}
          className={cn(
            "fixed left-[50vw] top-[50vh] z-50 w-[min(100vw-1.5rem,26rem)] max-h-[min(90vh,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 shadow-lg",
            "dark:border-zinc-800 dark:bg-zinc-900",
            "[&::backdrop]:bg-black/40",
          )}
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isCreate ? "Create role" : "Edit role"}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {isCreate
                ? "Name the role and pick permissions."
                : "Update name and permissions."}
            </p>
          </div>

          {draft !== null ? (
            <>
              <form
                id="role-modal-save"
                key={formKey}
                action={saveAction}
                className="flex flex-col"
              >
                <input
                  type="hidden"
                  name="roleId"
                  value={isCreate ? "" : editingRole?.id ?? ""}
                />

                <div className="max-h-[min(55vh,22rem)] space-y-4 overflow-y-auto px-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-modal-name">Name</Label>
                    {nameLockedForUser && editingRole ? (
                      <>
                        <p
                          id="role-modal-name"
                          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                        >
                          {editingRole.name}
                        </p>
                        <input
                          type="hidden"
                          name="name"
                          value={editingRole.name}
                        />
                      </>
                    ) : (
                      <Input
                        id="role-modal-name"
                        name="name"
                        required
                        autoComplete="off"
                        defaultValue={isCreate ? "" : editingRole?.name ?? ""}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Permissions</Label>
                    {catalogPermissions.length === 0 ? (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No permissions in catalog yet.
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-950/80">
                        {catalogPermissions.map((p) => (
                          <li key={p.id} className="flex gap-2 text-sm">
                            <input
                              type="checkbox"
                              id={`modal-perm-${p.id}`}
                              name="permissionId"
                              value={p.id}
                              defaultChecked={selectedPermissionIds.has(p.id)}
                              className="mt-1 rounded border-zinc-300 dark:border-zinc-600 dark:bg-zinc-900"
                            />
                            <label
                              htmlFor={`modal-perm-${p.id}`}
                              className="min-w-0 cursor-pointer"
                            >
                              <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                                {p.code}
                              </span>
                              {p.description ? (
                                <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
                                  {p.description}
                                </span>
                              ) : null}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  {editingRole &&
                  allowDeleteRoles &&
                  isRoleRemovable(editingRole) ? (
                    <form ref={deleteFormRef} action={delAction}>
                      <input type="hidden" name="roleId" value={editingRole.id} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/40"
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        Delete role
                      </Button>
                    </form>
                  ) : (
                    <span />
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => dialogRef.current?.close()}
                    >
                      Cancel
                    </Button>
                    <SaveSubmit label={isCreate ? "Create" : "Save"} />
                  </div>
                </div>
              </form>
            </>
          ) : null}
        </dialog>

        {editingRole &&
        allowDeleteRoles &&
        isRoleRemovable(editingRole) ? (
          <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title={`Delete role “${editingRole.name}”?`}
            description="This cannot be undone. Anyone assigned this role will have it removed from their profile."
            confirmLabel="Delete role"
            cancelLabel="Cancel"
            tone="danger"
            isPending={isDeletePending}
            onConfirm={() => deleteFormRef.current?.requestSubmit()}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
