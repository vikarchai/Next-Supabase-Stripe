"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  createOrganizationAction,
  switchOrganizationAction,
  type OrganizationActionState,
} from "@/actions/organization";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_ORG_STORAGE_KEY } from "@/lib/dashboard-client-storage";
import { cn } from "@/lib/utils";

function CreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Creating…" : "Create"}
    </Button>
  );
}

function resolveSelectedOrgId(
  organizations: { id: string; name: string; roleName: string | null }[],
  currentOrganizationId: string | null,
) {
  if (
    currentOrganizationId &&
    organizations.some((o) => o.id === currentOrganizationId)
  ) {
    return currentOrganizationId;
  }
  return "";
}

function OrgSwitchSelect({
  organizations,
  value,
  serverActiveId,
  onSelectedChange,
}: {
  organizations: { id: string; name: string; roleName: string | null }[];
  value: string;
  serverActiveId: string | null;
  onSelectedChange: (id: string) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <select
      name="organizationId"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        onSelectedChange(next);
        if (next && next !== serverActiveId) {
          e.currentTarget.closest("form")?.requestSubmit();
        }
      }}
      aria-label="Switch organization"
      className="h-9 min-w-[10rem] max-w-[14rem] cursor-pointer rounded-md border border-zinc-300 bg-white py-0 pl-2.5 pr-9 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
          {org.roleName ? ` (${org.roleName})` : ""}
        </option>
      ))}
    </select>
  );
}

function SwitchOrganizationForm({
  switchAction,
  switchState,
  organizations,
  currentOrganizationId,
}: {
  switchAction: (payload: FormData) => void;
  switchState: OrganizationActionState;
  organizations: { id: string; name: string; roleName: string | null }[];
  currentOrganizationId: string | null;
}) {
  const [selectedId, setSelectedId] = useState(() =>
    resolveSelectedOrgId(organizations, currentOrganizationId),
  );

  useEffect(() => {
    setSelectedId(resolveSelectedOrgId(organizations, currentOrganizationId));
  }, [currentOrganizationId, organizations]);

  useEffect(() => {
    if (switchState.error) {
      setSelectedId(resolveSelectedOrgId(organizations, currentOrganizationId));
    }
  }, [switchState.error, currentOrganizationId, organizations]);

  return (
    <form action={switchAction} className="contents">
      <OrgSwitchSelect
        organizations={organizations}
        value={selectedId}
        serverActiveId={currentOrganizationId}
        onSelectedChange={setSelectedId}
      />
    </form>
  );
}

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  canCreateOrganization,
  canSwitchOrganization,
}: {
  organizations: { id: string; name: string; roleName: string | null }[];
  currentOrganizationId: string | null;
  canCreateOrganization: boolean;
  canSwitchOrganization: boolean;
}) {
  const inv = useDashboardCacheInvalidation();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const initial: OrganizationActionState = { ok: false };
  const [createState, createAction] = useActionState(
    createOrganizationAction,
    initial,
  );
  const [switchState, switchAction] = useActionState(
    switchOrganizationAction,
    initial,
  );

  useEffect(() => {
    if (createState.error) toast.error(createState.error);
    else if (createState.ok && createState.message) {
      toast.success(createState.message);
      try {
        sessionStorage.removeItem(DASHBOARD_ORG_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      dialogRef.current?.close();
      setCreateModalOpen(false);
      inv?.invalidateAllDashboard();
      router.refresh();
    }
  }, [createState, router, inv]);

  useEffect(() => {
    if (switchState.error) toast.error(switchState.error);
    else if (switchState.ok && switchState.message) {
      toast.success(switchState.message);
      try {
        sessionStorage.removeItem(DASHBOARD_ORG_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      inv?.invalidateAllDashboard();
      router.refresh();
    }
  }, [switchState, router, inv]);

  const showSwitch =
    canSwitchOrganization &&
    currentOrganizationId &&
    (organizations.length > 1 || canCreateOrganization);

  if (!showSwitch && !canCreateOrganization) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showSwitch ? (
          <SwitchOrganizationForm
            switchAction={switchAction}
            switchState={switchState}
            organizations={organizations}
            currentOrganizationId={currentOrganizationId}
          />
        ) : null}
        {canCreateOrganization ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              dialogRef.current?.showModal();
              setCreateModalOpen(true);
            }}
          >
            Create organization
          </Button>
        ) : null}
      </div>

      {canCreateOrganization ? (
        <dialog
          ref={dialogRef}
          onClose={() => setCreateModalOpen(false)}
          className={cn(
            "fixed left-[50vw] top-[50vh] z-[100] w-[min(100vw-1.5rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
            "[&::backdrop]:bg-black/50",
          )}
        >
          <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Create organization
            </h2>
          </div>
          <form
            key={createModalOpen ? "open" : "closed"}
            action={createAction}
            className="space-y-4 p-4"
          >
            <div className="space-y-2">
              <Label htmlFor="organizationName">Name</Label>
              <Input
                id="organizationName"
                name="organizationName"
                required
                minLength={1}
                maxLength={120}
                placeholder="Acme Inc."
                autoComplete="organization"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  dialogRef.current?.close();
                  setCreateModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <CreateSubmitButton />
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
