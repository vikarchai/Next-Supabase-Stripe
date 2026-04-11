"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { assertMemberCapacityForInvite } from "@/lib/billing/plan-enforcement";
import { resolveActionOrgContext } from "@/lib/auth/action-context";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getDb } from "@/db";
import {
  getPermissionCodesForUser,
} from "@/lib/permissions";
import {
  organization_invites,
  organization_memberships,
  profiles,
  roles,
} from "@/db/schema";
import { revalidatePath } from "next/cache";

import { revalidateDashboardOrganizationData } from "@/lib/dashboard-cache/tags";
import { redirect } from "next/navigation";

export type InviteActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const MEMBERS_INVITE = "members:invite";

function isSupabaseUserAlreadyExistsError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    (msg.includes("already") &&
      (msg.includes("exists") || msg.includes("user")))
  );
}

/**
 * Invited users are created in auth.users with invite metadata and invited_at set.
 * Used to safely reset a stale invite so inviteUserByEmail can send a fresh link.
 */
async function findInvitedAuthUserIdForOrg(
  emailNorm: string,
  organizationId: string,
): Promise<string | null> {
  const db = getDb();
  try {
    const rows = await db.execute(
      sql`select u.id::text as id
          from auth.users u
          where lower(trim(u.email)) = ${emailNorm}
            and u.invited_at is not null
            and coalesce(u.raw_user_meta_data->>'invite_organization_id', '') = ${organizationId}
          limit 1`,
    );
    const first = (rows as unknown as { id: string }[])[0];
    return first?.id ?? null;
  } catch {
    return null;
  }
}

/** Only the Owner role may revoke or resend pending invitations. */
async function userIsOrgOwner(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ slug: roles.slug })
    .from(profiles)
    .innerJoin(roles, eq(profiles.role_id, roles.id))
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.slug === "owner";
}

export async function inviteMemberAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Not signed in." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "No organization for your profile." };
  }
  const { userId, organizationId: orgId } = ctx;

  const codes = await getPermissionCodesForUser(userId);
  if (!codes.has(MEMBERS_INVITE)) {
    return { ok: false, error: "You do not have permission to invite members." };
  }

  const emailParsed = z
    .string()
    .email("Enter a valid email address")
    .safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!emailParsed.success) {
    return {
      ok: false,
      error: emailParsed.error.issues[0]?.message ?? "Invalid email",
    };
  }
  const emailNorm = emailParsed.data;

  const db = getDb();

  const [pendingInvite] = await db
    .select({ id: organization_invites.id })
    .from(organization_invites)
    .where(
      and(
        eq(organization_invites.organization_id, orgId),
        eq(organization_invites.email, emailNorm),
      ),
    )
    .limit(1);
  if (pendingInvite) {
    return {
      ok: false,
      error:
        "An invitation is already pending for this email. Use Resend on the members list, or remove the invite first.",
    };
  }

  const seatCheck = await assertMemberCapacityForInvite(orgId);
  if (!seatCheck.ok) {
    return { ok: false, error: seatCheck.error };
  }

  const [managerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(eq(roles.organization_id, orgId), eq(roles.slug, "manager")),
    )
    .limit(1);
  if (!managerRole) {
    return {
      ok: false,
      error: "Manager role is missing for this organization.",
    };
  }

  try {
    const dupRows = await db.execute(
      sql`select p.id::text as id from profiles p
          inner join auth.users u on u.id = p.id
          where lower(trim(u.email)) = ${emailNorm}
          and p.organization_id = ${orgId}
          limit 1`,
    );
    const first = (dupRows as unknown as { id: string }[])[0];
    if (first?.id) {
      return {
        ok: false,
        error: "This user is already a member of your organization.",
      };
    }
  } catch {
    /* If auth.users is not readable, skip duplicate check */
  }

  let adminClient;
  try {
    adminClient = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return {
      ok: false,
      error: `Invites are not configured: ${msg}`,
    };
  }

  const redirectTo = `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent("/register/invite")}`;

  const { error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(emailNorm, {
      data: {
        invite_organization_id: orgId,
        invite_role_id: managerRole.id,
        full_name: "",
        avatar_url: null,
      },
      redirectTo,
    });

  if (inviteError) {
    if (isSupabaseUserAlreadyExistsError(inviteError.message)) {
      return {
        ok: false,
        error:
          "This email already has a Supabase account (for example from a previous invite). They can sign in with “Forgot password” if needed. To send a fresh invite, remove the pending row from Members first, or use Resend if they are still invited.",
      };
    }
    return { ok: false, error: inviteError.message };
  }

  await db
    .insert(organization_invites)
    .values({
      email: emailNorm,
      organization_id: orgId,
      role_id: managerRole.id,
      invited_by_user_id: userId,
    })
    .onConflictDoNothing({
      target: [organization_invites.organization_id, organization_invites.email],
    });

  revalidateDashboardOrganizationData(orgId);
  revalidatePath("/organization");
  return {
    ok: true,
    message: "Invitation sent. They will receive an email with a link to finish signing up.",
  };
}

export async function revokeInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Not signed in." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "No organization for your profile." };
  }
  const { userId, organizationId: orgId } = ctx;

  if (!(await userIsOrgOwner(userId))) {
    return {
      ok: false,
      error: "Only the organization owner can remove pending invitations.",
    };
  }

  const idParsed = z
    .string()
    .uuid("Invalid invite")
    .safeParse(String(formData.get("inviteId") ?? "").trim());
  if (!idParsed.success) {
    return { ok: false, error: idParsed.error.issues[0]?.message ?? "Invalid invite" };
  }

  const db = getDb();
  const [row] = await db
    .select({ id: organization_invites.id })
    .from(organization_invites)
    .where(
      and(
        eq(organization_invites.id, idParsed.data),
        eq(organization_invites.organization_id, orgId),
      ),
    )
    .limit(1);

  if (!row) {
    return { ok: false, error: "Invitation not found." };
  }

  await db
    .delete(organization_invites)
    .where(eq(organization_invites.id, row.id));

  revalidateDashboardOrganizationData(orgId);
  revalidatePath("/organization");
  return { ok: true, message: "Invitation removed." };
}

export async function resendInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Not signed in." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "No organization for your profile." };
  }
  const { userId, organizationId: orgId } = ctx;

  if (!(await userIsOrgOwner(userId))) {
    return {
      ok: false,
      error: "Only the organization owner can resend invitations.",
    };
  }

  const idParsed = z
    .string()
    .uuid("Invalid invite")
    .safeParse(String(formData.get("inviteId") ?? "").trim());
  if (!idParsed.success) {
    return { ok: false, error: idParsed.error.issues[0]?.message ?? "Invalid invite" };
  }

  const db = getDb();
  const [invite] = await db
    .select()
    .from(organization_invites)
    .where(
      and(
        eq(organization_invites.id, idParsed.data),
        eq(organization_invites.organization_id, orgId),
      ),
    )
    .limit(1);

  if (!invite) {
    return { ok: false, error: "Invitation not found." };
  }

  let adminClient;
  try {
    adminClient = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return {
      ok: false,
      error: `Invites are not configured: ${msg}`,
    };
  }

  const redirectTo = `${getPublicSiteUrl()}/auth/callback?next=${encodeURIComponent("/register/invite")}`;

  const invitePayload = {
    data: {
      invite_organization_id: orgId,
      invite_role_id: invite.role_id,
      full_name: "",
      avatar_url: null,
    },
    redirectTo,
  } as const;

  let inviteError = (
    await adminClient.auth.admin.inviteUserByEmail(invite.email, invitePayload)
  ).error;

  if (inviteError && isSupabaseUserAlreadyExistsError(inviteError.message)) {
    const authUserId = await findInvitedAuthUserIdForOrg(invite.email, orgId);
    if (!authUserId) {
      return {
        ok: false,
        error:
          "This email is already registered in Auth under another flow. Ask them to sign in (Forgot password) or remove this pending invite and resolve the account in Supabase Dashboard.",
      };
    }
    const [existingProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, authUserId))
      .limit(1);
    if (existingProfile) {
      return {
        ok: false,
        error:
          "This person already completed signup. Remove the stale pending invite from the list.",
      };
    }
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(authUserId);
    if (deleteError) {
      return {
        ok: false,
        error: `Could not issue a fresh invite: ${deleteError.message}`,
      };
    }
    inviteError = (
      await adminClient.auth.admin.inviteUserByEmail(
        invite.email,
        invitePayload,
      )
    ).error;
  }

  if (inviteError) {
    return {
      ok: false,
      error: inviteError.message,
    };
  }

  await db
    .update(organization_invites)
    .set({
      invited_by_user_id: userId,
      created_at: sql`now()`,
    })
    .where(eq(organization_invites.id, invite.id));

  revalidateDashboardOrganizationData(orgId);
  revalidatePath("/organization");
  return {
    ok: true,
    message: "Invitation email sent again.",
  };
}

const completeInviteSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function completeInviteProfileAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

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
    return {
      ok: false,
      error: "This account is not linked to an invitation.",
    };
  }

  const db = getDb();

  const [existingProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (existingProfile) {
    return { ok: false, error: "Your profile is already set up. Go to the dashboard." };
  }

  const emailNorm = user.email.trim().toLowerCase();

  const [invite] = await db
    .select()
    .from(organization_invites)
    .where(
      and(
        eq(organization_invites.organization_id, orgId),
        eq(organization_invites.email, emailNorm),
      ),
    )
    .limit(1);

  if (!invite || invite.role_id !== roleId) {
    return {
      ok: false,
      error: "No valid invitation found for this email and organization.",
    };
  }

  const raw = {
    fullName: String(formData.get("fullName") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = completeInviteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid inputs",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: {
      full_name: parsed.data.fullName,
      avatar_url: null,
    },
  });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await db.insert(profiles).values({
    id: user.id,
    full_name: parsed.data.fullName,
    avatar_url: null,
    organization_id: orgId,
    role_id: roleId,
    may_create_own_organization: true,
  });

  await db
    .insert(organization_memberships)
    .values({
      user_id: user.id,
      organization_id: orgId,
      role_id: roleId,
    })
    .onConflictDoNothing({
      target: [
        organization_memberships.user_id,
        organization_memberships.organization_id,
      ],
    });

  await db
    .delete(organization_invites)
    .where(eq(organization_invites.id, invite.id));

  revalidateDashboardOrganizationData(orgId);
  revalidatePath("/dashboard");
  revalidatePath("/organization");
  redirect("/dashboard");
}
