"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { revalidateDashboardDealData } from "@/lib/dashboard-cache/tags";
import { z } from "zod";

import { getDb } from "@/db";
import { deals } from "@/db/schema";
import {
  assertProjectBelongsToOrganization,
  getDefaultProjectIdForOrganization,
} from "@/lib/projects/org-projects";
import { randomPdfStorageFileName } from "@/lib/deals/pdf-file-name";
import { DEAL_DOCUMENTS_BUCKET } from "@/lib/deals/storage";
import { resolveActionOrgContext } from "@/lib/auth/action-context";
import {
  assertDealCapacity,
  assertPdfStorageAllows,
} from "@/lib/billing/plan-enforcement";
import {
  assertPermission,
  PERM_DEALS_CREATE,
  PERM_DEALS_DELETE,
  PERM_DEALS_READ,
  PERM_DEALS_UPDATE,
} from "@/lib/permissions";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export type DealActionState = { ok: boolean; error?: string };

const statusValues = [
  "draft",
  "negotiation",
  "won",
  "lost",
  "archived",
] as const;

function revalidateDealPaths(dealId: string, organizationId: string) {
  revalidateDashboardDealData(organizationId);
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
}

async function loadDealForOrg(dealId: string, organizationId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(deals)
    .where(
      and(eq(deals.id, dealId), eq(deals.organization_id, organizationId)),
    )
    .limit(1);
  return rows[0];
}

function parseOptionalDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createDealAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_DEALS_CREATE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const dealCap = await assertDealCapacity(orgId);
  if (!dealCap.ok) return { ok: false, error: dealCap.error };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    return { ok: false, error: "Enter a deal title (at least 2 characters)." };
  }

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;

  const amountNoteRaw = String(formData.get("amount_note") ?? "").trim();
  const amount_note = amountNoteRaw.length > 0 ? amountNoteRaw : null;

  const statusParsed = z
    .enum(statusValues)
    .safeParse(String(formData.get("status") ?? "draft"));
  if (!statusParsed.success) {
    return { ok: false, error: "Invalid status." };
  }

  const start_at = parseOptionalDate(
    String(formData.get("start_at") ?? ""),
  );
  const end_at = parseOptionalDate(String(formData.get("end_at") ?? ""));

  const file = formData.get("pdf");
  const pdfFile =
    file instanceof File && file.size > 0 ? file : null;

  if (pdfFile) {
    if (pdfFile.type !== "application/pdf") {
      return { ok: false, error: "Only PDF files are allowed." };
    }
    const storage = await assertPdfStorageAllows(orgId, pdfFile.size, 0);
    if (!storage.ok) return { ok: false, error: storage.error };
  }

  const defaultProjectId = await getDefaultProjectIdForOrganization(orgId);
  if (!defaultProjectId) {
    return {
      ok: false,
      error: "This organization has no default project. Contact support.",
    };
  }
  const rawProjectId = String(formData.get("project_id") ?? "").trim();
  let projectId = defaultProjectId;
  if (rawProjectId && z.string().uuid().safeParse(rawProjectId).success) {
    const belongs = await assertProjectBelongsToOrganization(rawProjectId, orgId);
    if (belongs) projectId = rawProjectId;
  }

  const db = getDb();
  const [inserted] = await db
    .insert(deals)
    .values({
      organization_id: orgId,
      project_id: projectId,
      title,
      description,
      status: statusParsed.data,
      start_at,
      end_at,
      amount_note,
      created_by: userId,
    })
    .returning({ id: deals.id });

  if (!inserted) {
    return { ok: false, error: "Could not create the deal." };
  }

  const dealId = inserted.id;

  if (pdfFile) {
    try {
      const admin = createSupabaseServiceClient();
      const bytes = new Uint8Array(await pdfFile.arrayBuffer());
      const storageName = randomPdfStorageFileName();
      const objectPath = `${orgId}/${dealId}/${storageName}`;

      const { error: upErr } = await admin.storage
        .from(DEAL_DOCUMENTS_BUCKET)
        .upload(objectPath, bytes, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (upErr) {
        await db.delete(deals).where(eq(deals.id, dealId));
        return {
          ok: false,
          error: `Upload failed: ${upErr.message}. Check the “${DEAL_DOCUMENTS_BUCKET}” bucket and your service role key.`,
        };
      }

      await db
        .update(deals)
        .set({
          pdf_storage_path: objectPath,
          pdf_original_name: storageName,
          pdf_bytes: pdfFile.size,
          updated_at: new Date(),
        })
        .where(eq(deals.id, dealId));
    } catch (e) {
      await db.delete(deals).where(eq(deals.id, dealId));
      const msg = e instanceof Error ? e.message : "Upload failed.";
      return {
        ok: false,
        error:
          msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("service")
            ? "File uploads require SUPABASE_SERVICE_ROLE_KEY in .env.local."
            : msg,
      };
    }
  }

  revalidateDashboardDealData(orgId);
  revalidatePath("/deals");
  return { ok: true };
}

export async function updateDealStatusAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_DEALS_UPDATE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (!z.string().uuid().safeParse(dealId).success) {
    return { ok: false, error: "Invalid deal." };
  }

  const statusParsed = z
    .enum(statusValues)
    .safeParse(String(formData.get("status") ?? ""));
  if (!statusParsed.success) {
    return { ok: false, error: "Invalid status." };
  }

  const row = await loadDealForOrg(dealId, orgId);
  if (!row) return { ok: false, error: "Deal not found." };

  const db = getDb();
  await db
    .update(deals)
    .set({ status: statusParsed.data, updated_at: new Date() })
    .where(eq(deals.id, dealId));

  revalidateDealPaths(dealId, orgId);
  return { ok: true };
}

export async function updateDealFieldsAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_DEALS_UPDATE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (!z.string().uuid().safeParse(dealId).success) {
    return { ok: false, error: "Invalid deal." };
  }

  const row = await loadDealForOrg(dealId, orgId);
  if (!row) return { ok: false, error: "Deal not found." };

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) {
    return { ok: false, error: "Enter a deal title (at least 2 characters)." };
  }

  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;

  const amountNoteRaw = String(formData.get("amount_note") ?? "").trim();
  const amount_note = amountNoteRaw.length > 0 ? amountNoteRaw : null;

  const statusParsed = z
    .enum(statusValues)
    .safeParse(String(formData.get("status") ?? ""));
  if (!statusParsed.success) {
    return { ok: false, error: "Invalid status." };
  }

  const start_at = parseOptionalDate(String(formData.get("start_at") ?? ""));
  const end_at = parseOptionalDate(String(formData.get("end_at") ?? ""));

  const db = getDb();
  await db
    .update(deals)
    .set({
      title,
      description,
      status: statusParsed.data,
      amount_note,
      start_at,
      end_at,
      updated_at: new Date(),
    })
    .where(eq(deals.id, dealId));

  revalidateDealPaths(dealId, orgId);
  return { ok: true };
}

export async function replaceDealPdfAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_DEALS_UPDATE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (!z.string().uuid().safeParse(dealId).success) {
    return { ok: false, error: "Invalid deal." };
  }

  const row = await loadDealForOrg(dealId, orgId);
  if (!row) return { ok: false, error: "Deal not found." };

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF files are allowed." };
  }
  const storage = await assertPdfStorageAllows(
    orgId,
    file.size,
    row.pdf_bytes ?? 0,
  );
  if (!storage.ok) return { ok: false, error: storage.error };

  try {
    const admin = createSupabaseServiceClient();
    if (row.pdf_storage_path) {
      await admin.storage
        .from(DEAL_DOCUMENTS_BUCKET)
        .remove([row.pdf_storage_path]);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const storageName = randomPdfStorageFileName();
    const objectPath = `${orgId}/${dealId}/${storageName}`;

    const { error: upErr } = await admin.storage
      .from(DEAL_DOCUMENTS_BUCKET)
      .upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (upErr) {
      return { ok: false, error: `Upload failed: ${upErr.message}` };
    }

    const db = getDb();
    await db
      .update(deals)
      .set({
        pdf_storage_path: objectPath,
        pdf_original_name: storageName,
        pdf_bytes: file.size,
        updated_at: new Date(),
      })
      .where(eq(deals.id, dealId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return {
      ok: false,
      error:
        msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("service")
          ? "File uploads require SUPABASE_SERVICE_ROLE_KEY in .env.local."
          : msg,
    };
  }

  revalidateDealPaths(dealId, orgId);
  return { ok: true };
}

export type SignedUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function getDealPdfSignedUrlAction(
  dealId: string,
): Promise<SignedUrlResult> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_DEALS_READ);
  if (!perm.ok) return { ok: false, error: perm.error };

  if (!z.string().uuid().safeParse(dealId).success) {
    return { ok: false, error: "Invalid deal." };
  }

  const row = await loadDealForOrg(dealId, orgId);
  if (!row?.pdf_storage_path) {
    return { ok: false, error: "No file attached." };
  }

  try {
    const admin = createSupabaseServiceClient();
    const { data, error } = await admin.storage
      .from(DEAL_DOCUMENTS_BUCKET)
      .createSignedUrl(row.pdf_storage_path, 120);

    if (error || !data?.signedUrl) {
      return {
        ok: false,
        error: error?.message ?? "Could not create a download link.",
      };
    }
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: msg };
  }
}

export async function deleteDealAction(
  _prev: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Sign in to continue." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "Your profile has no organization." };
  }
  const { userId, organizationId: orgId } = ctx;

  const perm = await assertPermission(userId, PERM_DEALS_DELETE);
  if (!perm.ok) return { ok: false, error: perm.error };

  const dealId = String(formData.get("deal_id") ?? "").trim();
  if (!z.string().uuid().safeParse(dealId).success) {
    return { ok: false, error: "Invalid deal." };
  }

  const row = await loadDealForOrg(dealId, orgId);
  if (!row) return { ok: false, error: "Deal not found." };

  if (row.pdf_storage_path) {
    try {
      const admin = createSupabaseServiceClient();
      await admin.storage
        .from(DEAL_DOCUMENTS_BUCKET)
        .remove([row.pdf_storage_path]);
    } catch {
      // still delete DB row
    }
  }

  const db = getDb();
  await db.delete(deals).where(eq(deals.id, dealId));

  revalidateDashboardDealData(orgId);
  revalidatePath("/dashboard");
  revalidatePath("/deals");
  return { ok: true };
}
