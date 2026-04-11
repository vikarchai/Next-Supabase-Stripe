import { NextResponse } from "next/server";

import { loadDealsApiPayload } from "@/lib/dashboard-api/load-deals";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project") ?? undefined;
  const result = await loadDealsApiPayload(project);

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
