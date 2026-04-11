"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useRef } from "react";

function safeNextClient(nextRaw: string | null): string {
  const n = nextRaw ?? "/dashboard";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

/** Fragment can appear slightly after first paint on some redirects — short wait. */
async function waitForHashParams(maxMs = 400): Promise<URLSearchParams> {
  const start = Date.now();
  let hash = window.location.hash;
  while (Date.now() - start < maxMs) {
    if (hash && hash.length > 1) {
      return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    }
    await new Promise((r) => setTimeout(r, 50));
    hash = window.location.hash;
  }
  return new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash.replace(/^#/, ""),
  );
}

export function AuthCallbackHandler() {
  const finished = useRef(false);

  useEffect(() => {
    async function run() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
      const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();

      if (!supabaseUrl || !supabasePublishableKey) {
        if (!finished.current) {
          finished.current = true;
          window.location.replace("/login?reason=config");
        }
        return;
      }

      const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);

      const q = new URLSearchParams(window.location.search);
      let hashParams = new URLSearchParams(
        window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash.replace(/^#/, ""),
      );

      const nextRaw = q.get("next");
      const safeNext = safeNextClient(nextRaw);

      const redirectSuccess = (path: string = safeNext) => {
        if (finished.current) return;
        finished.current = true;
        window.location.replace(path);
      };

      const handleError = (msg: string) => {
        if (finished.current) return;
        finished.current = true;
        window.location.replace(
          `/login?reason=callback&message=${encodeURIComponent(msg)}`,
        );
      };

      try {
        const oauthError =
          hashParams.get("error_description") ||
          hashParams.get("error") ||
          q.get("error_description") ||
          q.get("error");
        if (oauthError) {
          return handleError(oauthError);
        }

        // Implicit flow tokens may arrive in the hash after redirect — brief wait.
        if (!hashParams.toString()) {
          hashParams = await waitForHashParams();
        }

        const oauthErrorHash =
          hashParams.get("error_description") || hashParams.get("error");
        if (oauthErrorHash) {
          return handleError(oauthErrorHash);
        }

        // Implicit flow: access_token + refresh_token in hash.
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) return handleError(error.message);
          await supabase.auth.getUser();
          return redirectSuccess();
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (user) {
          return redirectSuccess();
        }

        handleError(userError?.message || "No active session found.");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Sign-in failed.";
        handleError(message);
      }
    }

    void run();
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        <p className="text-sm text-zinc-600">Completing sign-in…</p>
      </div>
    </div>
  );
}
