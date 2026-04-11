import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * One authenticated-user lookup per request render.
 *
 * Uses `getUser()` (Auth API) and is wrapped in React `cache()` so that multiple
 * Server Components on the same request do not trigger waterfalls.
 */
export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
});

