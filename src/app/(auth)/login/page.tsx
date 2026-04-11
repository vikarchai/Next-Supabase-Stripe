import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthQueryToast } from "@/components/auth/auth-query-toast";
import { LoginForm } from "@/components/auth/LoginForm";
import { getAuthenticatedUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getAuthenticatedUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-[calc(100vh-0px)] items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <Suspense fallback={null}>
        <AuthQueryToast />
      </Suspense>
      <LoginForm />
    </main>
  );
}

