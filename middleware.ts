import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  // 1. Check protected routes first to avoid unnecessary Auth calls.
  const path = req.nextUrl.pathname;
  const protectedPrefixes = ["/dashboard", "/deals", "/profile", "/organization", "/roles", "/billing"];
  const isProtectedAppRoute = protectedPrefixes.some((prefix) => path.startsWith(prefix));

  // 2. Middleware must stay fast: we only need to know if a session exists.
  // `getSession()` reads JWT from cookies without an extra Auth API round-trip.
  const { data: { session } } = await supabase.auth.getSession();

  // 3. Redirect unauthenticated users.
  if (isProtectedAppRoute && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Keep the original destination in the `next` query parameter.
    url.searchParams.set("next", path); 
    return NextResponse.redirect(url);
  }

  // Prevent caching for auth-sensitive responses.
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: [
    /*
     * Optimized matcher:
     * - Exclude static assets, images, and favicon
     * - Exclude API routes (they have their own auth checks)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};