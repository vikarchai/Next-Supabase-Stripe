"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { completeOAuthProfileAction } from "@/actions/auth";
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

type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
      {pending ? "Creating workspace…" : "Continue to dashboard"}
    </Button>
  );
}

export function OAuthOnboardingForm({
  defaultFullName,
  email,
}: {
  defaultFullName: string;
  email: string;
}) {
  const initial: ActionState = { ok: false };
  const [state, formAction] = useActionState(completeOAuthProfileAction, initial);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state?.error]);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Finish setup</CardTitle>
        <CardDescription>
          Signed in as {email}. Create your workspace and password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oauth-fullName">Full name</Label>
            <Input
              id="oauth-fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              defaultValue={defaultFullName}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oauth-organizationName">Organization name</Label>
            <Input
              id="oauth-organizationName"
              name="organizationName"
              type="text"
              autoComplete="organization"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oauth-password">Password</Label>
            <Input
              id="oauth-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="h-11"
            />
          </div>
          <SubmitButton />
        </form>
        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <a className="underline hover:text-zinc-900 dark:hover:text-zinc-100" href="/register">
            Prefer email and password?
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
