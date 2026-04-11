import { NextResponse } from "next/server";

import { loadRolesApiPayload } from "@/lib/dashboard-api/load-roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await loadRolesApiPayload();
  if (!result.ok) {
    const status =
      result.code === "unauthenticated"
        ? 401
        : result.code === "forbidden"
          ? 403
          : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
