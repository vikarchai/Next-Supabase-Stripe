"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const INVITE_LINK_COPY =
  "This sign-in link is invalid or has expired. Please ask someone in your organization to send you a new invitation email.";

/**
 * Auth errors passed via query string (callbacks, Google OAuth start failures, etc.).
 */
export function AuthQueryToast() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const reason = searchParams.get("reason");
    const legacyError = searchParams.get("error");
    const message = searchParams.get("message");

    if (!reason && !legacyError) return;

    if (reason === "signed_out") {
      toast.success("Signed out.", { id: "login-auth-signed-out" });
      router.replace("/login", { scroll: false });
      return;
    }

    const dedupeKey = `loginAuthToast:${reason ?? ""}:${legacyError ?? ""}:${message ?? ""}`;
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, "1");
    }

    const stripToCurrent = () =>
      router.replace(pathname || "/login", { scroll: false });

    if (reason === "invite_link" || legacyError === "auth") {
      const detail = message?.trim()
        ? ` (${decodeURIComponent(message)})`
        : "";
      toast.error(`${INVITE_LINK_COPY}${detail}`, {
        id: "login-auth-invite",
        duration: 14_000,
      });
      router.replace("/login", { scroll: false });
      return;
    }

    if (reason === "callback" && message) {
      toast.error(decodeURIComponent(message), {
        id: "login-auth-callback",
        duration: 10_000,
      });
      router.replace("/login", { scroll: false });
      return;
    }

    if (reason === "google" && message) {
      toast.error(decodeURIComponent(message), {
        id: "auth-google-oauth",
        duration: 10_000,
      });
      stripToCurrent();
      return;
    }

    if (reason === "config") {
      toast.error("The app is misconfigured (missing Supabase environment variables).", {
        id: "login-auth-config",
        duration: 10_000,
      });
      router.replace("/login", { scroll: false });
      return;
    }

    if (legacyError) {
      toast.error(decodeURIComponent(legacyError), {
        id: "login-auth-legacy",
        duration: 10_000,
      });
      stripToCurrent();
    }
  }, [searchParams, router, pathname]);

  return null;
}
