"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import {
  completeInviteProfileAction,
  type InviteActionState,
} from "@/actions/invite";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Complete setup"}
    </Button>
  );
}

export function InviteCompleteForm({
  email,
  organizationName,
}: {
  email: string;
  organizationName: string;
}) {
  const initial: InviteActionState = { ok: false };
  const [state, formAction] = useActionState(
    completeInviteProfileAction,
    initial,
  );
  const lastErr = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state?.error && state.error !== lastErr.current) {
      lastErr.current = state.error;
      toast.error(state.error);
    }
  }, [state?.error]);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          Set your name and password to join{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{organizationName}</span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-org">Organization</Label>
            <Input
              id="invite-org"
              value={organizationName}
              disabled
              readOnly
              className="bg-zinc-50 dark:bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              value={email}
              disabled
              readOnly
              className="bg-zinc-50 dark:bg-zinc-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
