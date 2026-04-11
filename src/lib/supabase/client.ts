"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase Client for use in Client Components.
 *
 * Unlike the server client, in the browser Supabase can read cookies itself
 * (via `document.cookie`), so we don’t need custom cookie handlers here.
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.",
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

