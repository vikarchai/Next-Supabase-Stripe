"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  resendInviteAction,
  revokeInviteAction,
  type InviteActionState,
} from "@/actions/invite";
import { useDashboardCacheInvalidation } from "@/components/providers/dashboard-data-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "Resend"}
    </Button>
  );
}

export function PendingInviteActions({ inviteId }: { inviteId: string }) {
  const inv = useDashboardCacheInvalidation();
  const initial: InviteActionState = { ok: false };
  const [revState, revokeAction, isRevokePending] = useActionState(
    revokeInviteAction,
    initial,
  );
  const [resState, resendAction] = useActionState(resendInviteAction, initial);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const revokeFormRef = useRef<HTMLFormElement>(null);

  const lastRev = useRef<string | undefined>(undefined);
  const lastRes = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (revState?.ok && revState.message) {
      toast.success(revState.message);
      inv?.invalidateOrganization();
      return;
    }
    if (revState?.error && revState.error !== lastRev.current) {
      lastRev.current = revState.error;
      toast.error(revState.error);
    }
  }, [revState, inv]);

  useEffect(() => {
    if (resState?.ok && resState.message) {
      toast.success(resState.message);
      inv?.invalidateOrganization();
      return;
    }
    if (resState?.error && resState.error !== lastRes.current) {
      lastRes.current = resState.error;
      toast.error(resState.error);
    }
  }, [resState, inv]);

  return (
    <div className="flex flex-wrap gap-2">
      <form action={resendAction}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <ResendButton />
      </form>

      <form ref={revokeFormRef} action={revokeAction}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => setRevokeOpen(true)}
        >
          Remove
        </Button>
      </form>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Remove invitation?"
        description="They will not be able to finish signing up using links from the invitation email. You can send a new invite later if needed."
        confirmLabel="Remove invitation"
        cancelLabel="Cancel"
        tone="danger"
        isPending={isRevokePending}
        onConfirm={() => revokeFormRef.current?.requestSubmit()}
      />
    </div>
  );
}
