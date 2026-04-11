import { redirect } from "next/navigation";

import { OAuthOnboardingForm } from "@/components/auth/OAuthOnboardingForm";
import { getViewer, onboardingRedirectPath } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

function displayNameFromUser(user: {
  user_metadata?: Record<string, unknown> | null;
  email?: string | null;
}): string {
  const meta = user.user_metadata;
  if (meta && typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (meta && typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  const email = user.email?.trim();
  if (email && email.includes("@")) {
    return email.split("@")[0] ?? "";
  }
  return "";
}

export default async function RegisterOAuthPage() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login?next=/register/oauth");
  }
  if (viewer.profile) {
    redirect("/dashboard");
  }

  const nextOnboarding = onboardingRedirectPath(viewer);
  if (nextOnboarding === "/register/invite") {
    redirect("/register/invite");
  }

  const defaultFullName = displayNameFromUser(viewer.user);
  const email = viewer.user.email ?? "";

  return (
    <main className="flex min-h-[calc(100vh-0px)] items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <OAuthOnboardingForm defaultFullName={defaultFullName} email={email} />
    </main>
  );
}
