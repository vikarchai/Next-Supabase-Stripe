import { NextResponse } from "next/server";

import { loadOrganizationApiPayload } from "@/lib/dashboard-api/load-organization";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await loadOrganizationApiPayload();
  if (!result.ok) {
    const status = result.code === "unauthenticated" ? 401 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
