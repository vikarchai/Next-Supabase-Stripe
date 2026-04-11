"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { getFreePlanId } from "@/lib/billing/plans";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getDb } from "@/db";
import {
  syncGlobalReferenceData,
  syncOrgStandardRolePermissions,
} from "@/db/role-seed";
import {
  organization_memberships,
  organizations,
  profiles,
  roles,
} from "@/db/schema";
import { insertDefaultProjectForOrganization } from "@/lib/projects/org-projects";

type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1, "Full name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
});

const oauthCompleteSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  fullName: z.string().min(1, "Full name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Default “Try DEMO” account; override with DEMO_LOGIN_EMAIL / DEMO_LOGIN_PASSWORD. */
const DEMO_LOGIN_EMAIL_DEFAULT = "statutorydorine@sharebot.net";
const DEMO_LOGIN_PASSWORD_DEFAULT = "123321123321";

async function provisionOrgAndProfile(params: {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  organizationName: string;
}) {
  await syncGlobalReferenceData();
  const organizationId = randomUUID();
  const db = getDb();
  const freePlanId = await getFreePlanId();

  await db.insert(organizations).values({
    id: organizationId,
    name: params.organizationName,
    plan_id: freePlanId,
  });

  await insertDefaultProjectForOrganization(db, organizationId);

  const adminRoleId = randomUUID();
  const managerRoleId = randomUUID();
  const ownerRoleId = randomUUID();

  await db.insert(roles).values([
    {
      id: adminRoleId,
      organization_id: organizationId,
      name: "Admin",
      is_system: true,
      slug: "admin",
    },
    {
      id: managerRoleId,
      organization_id: organizationId,
      name: "Manager",
      is_system: false,
      slug: "manager",
    },
    {
      id: ownerRoleId,
      organization_id: organizationId,
      name: "Owner",
      is_system: true,
      slug: "owner",
    },
  ]);

  await syncOrgStandardRolePermissions(organizationId);

  await db.insert(profiles).values({
    id: params.userId,
    full_name: params.fullName,
    avatar_url: params.avatarUrl,
    organization_id: organizationId,
    role_id: ownerRoleId,
    may_create_own_organization: false,
  });

  await db.insert(organization_memberships).values({
    user_id: params.userId,
    organization_id: organizationId,
    role_id: ownerRoleId,
  });
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = createSupabaseServerActionClient();

  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inputs" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { ok: false, error: error.message };
  if (data.session) {
    redirect("/dashboard");
  }
  return {
    ok: false,
    error: "No active session. Confirm your email or try again.",
  };
}

export async function demoLoginAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _prevState;
  void _formData;
  const email =
    process.env.DEMO_LOGIN_EMAIL?.trim() || DEMO_LOGIN_EMAIL_DEFAULT;
  const password =
    process.env.DEMO_LOGIN_PASSWORD?.trim() || DEMO_LOGIN_PASSWORD_DEFAULT;

  const supabase = createSupabaseServerActionClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { ok: false, error: error.message };
  if (data.session) {
    redirect("/dashboard");
  }
  return {
    ok: false,
    error: "No active session. Confirm your email or try again.",
  };
}

export async function registerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = createSupabaseServerActionClient();

  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    organizationName: String(formData.get("organizationName") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inputs" };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        avatar_url: null,
      },
    },
  });

  if (error) return { ok: false, error: error.message };

  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Sign up succeeded but no user id returned." };

  await provisionOrgAndProfile({
    userId,
    fullName: parsed.data.fullName,
    avatarUrl: null,
    organizationName: parsed.data.organizationName,
  });

  redirect("/dashboard");
}

/** For `<button formAction={…}>` — signature must be `(FormData) => void`. */
export async function startGoogleOAuth(formData: FormData): Promise<void> {
  const supabase = createSupabaseServerActionClient();

  const site = getPublicSiteUrl();
  const nextPath = "/register/oauth";
  const redirectTo = `${site}/auth/callback/server?next=${encodeURIComponent(nextPath)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  const returnPathRaw = String(formData.get("oauth_return_path") ?? "/login");
  const returnPath =
    returnPathRaw === "/register" ? "/register" : "/login";

  if (error) {
    redirect(
      `${returnPath}?reason=google&message=${encodeURIComponent(error.message)}`,
    );
  }
  if (data.url) {
    redirect(data.url);
  }
  redirect(
    `${returnPath}?reason=google&message=${encodeURIComponent("Could not start Google sign-in.")}`,
  );
}

export async function completeOAuthProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = createSupabaseServerActionClient();
 
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to continue." };

  const raw = {
    organizationName: String(formData.get("organizationName") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = oauthCompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid inputs" };
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

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const avatarFromMeta =
    (typeof meta?.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta?.picture === "string" && meta.picture) ||
    null;

  await provisionOrgAndProfile({
    userId: user.id,
    fullName: parsed.data.fullName.trim(),
    avatarUrl: avatarFromMeta,
    organizationName: parsed.data.organizationName.trim(),
  });

  redirect("/dashboard");
}

export async function logoutAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _prevState;
  void _formData;
  const supabase = createSupabaseServerActionClient();

  // Signs out and clears auth cookies via the SSR client cookie handlers.
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: error.message };

  redirect("/login?reason=signed_out");
}
