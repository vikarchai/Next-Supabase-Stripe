import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();

function requireSupabaseEnv() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.",
    );
  }
  return { supabaseUrl, supabasePublishableKey };
}

/**
 * For Server Components and `page.tsx` / `layout.tsx`.
 *
 * In RSC, cookies are read-only (`cookies().set` is not allowed). Token refresh
 * and cookie writes happen in `middleware.ts` where `res.cookies.set` is valid.
 */
export function createSupabaseServerClient() {
  const { supabaseUrl: url, supabasePublishableKey: key } = requireSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      async getAll() {
        const cookieStore = await cookies();
        return cookieStore.getAll();
      },
    },
  });
}

/**
 * For Server Actions only (sign-in, sign-up, sign-out).
 * Next allows `cookies().set` here so Supabase can persist the session.
 */
export function createSupabaseServerActionClient() {
  const { supabaseUrl: url, supabasePublishableKey: key } = requireSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      async getAll() {
        const cookieStore = await cookies();
        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        const cookieStore = await cookies();
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
