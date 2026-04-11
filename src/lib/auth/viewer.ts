import { cache } from "react";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/db";
import { organizations, plans, profiles, roles } from "@/db/schema";

/**
 * Shared app profile for the current request (layout + page + children).
 * Uses `getSession()` (cookie/JWT) instead of `getUser()` so we avoid an extra
 * round-trip to Supabase Auth on every navigation. Middleware already refreshes
 * the session when needed.
 */
export type ViewerProfile = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  organizationName: string | null;
  /** Active project plan (`plans.name`), e.g. Free / Pro. */
  organizationPlan: string | null;
  organizationPlanSlug: string | null;
  roleId: string | null;
  roleName: string | null;
  roleSlug: string | null;
  /** Invite flow: may create one own org until used. */
  mayCreateOwnOrganization: boolean;
};

export type Viewer = {
  user: User;
  profile: ViewerProfile | null;
};

/**
 * When the user has no app profile yet, they must complete invite acceptance
 * or OAuth/workspace onboarding before using the dashboard.
 */
export function onboardingRedirectPath(
  viewer: Viewer,
): "/register/invite" | "/register/oauth" | null {
  if (viewer.profile) return null;
  const meta = viewer.user.user_metadata as Record<string, unknown> | undefined;
  const invitedOrg =
    typeof meta?.invite_organization_id === "string"
      ? meta.invite_organization_id
      : undefined;
  const invitedRole =
    typeof meta?.invite_role_id === "string" ? meta.invite_role_id : undefined;
  if (invitedOrg && invitedRole) return "/register/invite";
  return "/register/oauth";
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const db = getDb();
  /** Run the profile query alone, then Supabase Auth: avoids competing for the single pooled PG connection (`max: 1` on Supabase) with other parallel work in the same request. */
  const [row] = await db
    .select({
      id: profiles.id,
      fullName: profiles.full_name,
      avatarUrl: profiles.avatar_url,
      organizationId: profiles.organization_id,
      organizationName: organizations.name,
      organizationPlan: plans.name,
      organizationPlanSlug: plans.slug,
      roleId: profiles.role_id,
      roleName: roles.name,
      roleSlug: roles.slug,
      mayCreateOwnOrganization: profiles.may_create_own_organization,
    })
    .from(profiles)
    .leftJoin(
      organizations,
      eq(profiles.organization_id, organizations.id),
    )
    .leftJoin(plans, eq(organizations.plan_id, plans.id))
    .leftJoin(roles, eq(profiles.role_id, roles.id))
    .where(eq(profiles.id, userId))
    .limit(1);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If we found profile by cookie session id but Auth API cannot validate user,
  // treat session as invalid.
  if (row && !user) return null;
  if (!user) return null;

  return {
    user,
    profile: row
      ? {
          id: row.id,
          fullName: row.fullName,
          avatarUrl: row.avatarUrl,
          organizationId: row.organizationId,
          organizationName: row.organizationName,
          organizationPlan: row.organizationPlan,
          organizationPlanSlug: row.organizationPlanSlug,
          roleId: row.roleId,
          roleName: row.roleName,
          roleSlug: row.roleSlug,
          mayCreateOwnOrganization: row.mayCreateOwnOrganization,
        }
      : null,
  };
});
