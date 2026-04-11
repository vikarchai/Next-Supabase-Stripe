import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { InviteCompleteForm } from "@/components/auth/InviteCompleteForm";
import { getDb } from "@/db";
import { organizations, profiles } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InviteRegisterPage() {
  const user = await getAuthenticatedUser();

  if (!user?.email) {
    redirect("/login?next=/register/invite");
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const orgId =
    typeof meta?.invite_organization_id === "string"
      ? meta.invite_organization_id
      : undefined;
  const roleId =
    typeof meta?.invite_role_id === "string"
      ? meta.invite_role_id
      : undefined;

  if (!orgId || !roleId) {
    redirect("/register");
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (existing) {
    redirect("/dashboard");
  }

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return (
    <main className="flex min-h-[calc(100vh-0px)] items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <InviteCompleteForm
        email={user.email}
        organizationName={org?.name ?? "Organization"}
      />
    </main>
  );
}
