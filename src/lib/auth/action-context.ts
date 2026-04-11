import { eq } from "drizzle-orm";

import { getAuthenticatedUser } from "@/lib/auth";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";

export type ActionOrgContext =
  | { kind: "ok"; userId: string; organizationId: string }
  | { kind: "no_org"; userId: string }
  | { kind: "anon" };

/**
 * One `getSession()` + one profile row for mutations. Prefer this over
 * `getUser()` per action (avoids a Supabase Auth HTTP round-trip).
 */
export async function resolveActionOrgContext(): Promise<ActionOrgContext> {
  const user = await getAuthenticatedUser();
  const userId = user?.id;
  if (!userId) return { kind: "anon" };

  const db = getDb();
  const [row] = await db
    .select({ organizationId: profiles.organization_id })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const organizationId = row?.organizationId ?? null;
  if (!organizationId) return { kind: "no_org", userId };

  return { kind: "ok", userId, organizationId };
}
