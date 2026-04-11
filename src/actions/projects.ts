"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { revalidateDashboardDealData } from "@/lib/dashboard-cache/tags";
import { z } from "zod";

import { resolveActionOrgContext } from "@/lib/auth/action-context";
import { assertProjectCapacity } from "@/lib/billing/plan-enforcement";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import {
  assertPermission,
  PERM_PROJECTS_MANAGE,
} from "@/lib/permissions";

export type ProjectActionState = { ok: boolean; error?: string; message?: string };

const nameSchema = z.string().trim().min(1, "Name is required").max(120);

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_PROJECTS_MANAGE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const cap = await assertProjectCapacity(orgId);
  if (!cap.ok) return { ok: false, error: cap.error };

  const parsed = nameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const db = getDb();
  await db.insert(projects).values({
    organization_id: orgId,
    name: parsed.data,
    is_default: false,
  });

  revalidateDashboardDealData(orgId);
  revalidatePath("/organization");
  revalidatePath("/deals");
  return { ok: true, message: "Project created." };
}

export async function renameProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_PROJECTS_MANAGE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const idParsed = z
    .string()
    .uuid("Invalid project")
    .safeParse(String(formData.get("project_id") ?? "").trim());
  if (!idParsed.success) {
    return { ok: false, error: idParsed.error.issues[0]?.message ?? "Invalid project" };
  }

  const nameParsed = nameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!nameParsed.success) {
    return { ok: false, error: nameParsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const db = getDb();
  const updated = await db
    .update(projects)
    .set({ name: nameParsed.data })
    .where(
      and(eq(projects.id, idParsed.data), eq(projects.organization_id, orgId)),
    )
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { ok: false, error: "Project not found." };
  }

  revalidateDashboardDealData(orgId);
  revalidatePath("/organization");
  revalidatePath("/deals");
  return { ok: true, message: "Project renamed." };
}
