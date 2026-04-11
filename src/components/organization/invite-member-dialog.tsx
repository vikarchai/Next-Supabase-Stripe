"use client";

import {
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  inviteMemberAction,
  type InviteActionState,
} from "@/actions/invite";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function SubmitInvite() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Sending…" : "Send invite"}
    </Button>
  );
}

export function InviteMemberButton({
  disabled = false,
  disabledReason,
}: {
  disabled?: boolean;
  disabledReason?: string;
}) {
  const inv = useDashboardCacheInvalidation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const initial: InviteActionState = { ok: false };
  const [state, formAction] = useActionState(inviteMemberAction, initial);
  const lastErr = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el || open) return;
    el.close();
  }, [open]);

  useLayoutEffect(() => {
    if (state?.ok && state.message) {
      toast.success(state.message);
      inv?.invalidateOrganization();
      dialogRef.current?.close();
      setOpen(false);
      lastErr.current = undefined;
      return;
    }
  }, [state, inv]);

  useEffect(() => {
    if (state?.error && state.error !== lastErr.current) {
      lastErr.current = state.error;
      toast.error(state.error);
    }
  }, [state?.error]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-label={disabled ? disabledReason : undefined}
        onClick={() => {
          if (disabled) return;
          dialogRef.current?.showModal();
          setOpen(true);
        }}
      >
        Invite
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className={cn(
          "fixed left-[50vw] top-[50vh] z-50 w-[min(100vw-1.5rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-0 shadow-lg",
          "[&::backdrop]:bg-black/40",
        )}
      >
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-900">
            Invite member
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            They will join as <span className="font-medium">Manager</span> and
            receive an email to set their name and password.
          </p>
        </div>
        <form
          key={open ? "open" : "closed"}
          action={formAction}
          className="flex flex-col gap-4 p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="colleague@company.com"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
            <SubmitInvite />
          </div>
        </form>
      </dialog>
    </>
  );
}
