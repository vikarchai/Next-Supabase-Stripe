"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";
import { DASHBOARD_ORG_STORAGE_KEY } from "@/lib/dashboard-client-storage";

type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button variant="outline" type="submit" disabled={pending} className="w-full">
      {pending ? "…" : label}
    </Button>
  );
}

type LogoutButtonProps = {
  className?: string;
  /** Button label (default English). */
  signOutLabel?: string;
};

export function LogoutButton({
  className,
  signOutLabel = "Sign out",
}: LogoutButtonProps) {
  const initialState: ActionState = { ok: false };

  const [state, formAction] = useActionState(logoutAction, initialState);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state?.error]);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={() => {
        try {
          sessionStorage.removeItem(DASHBOARD_ORG_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }}
    >
      <SubmitButton label={signOutLabel} />
    </form>
  );
}

