import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

function safeNext(nextRaw: string | null): string {
  const n = nextRaw ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function isEmailOtpType(v: string): v is (typeof EMAIL_OTP_TYPES)[number] {
  return (EMAIL_OTP_TYPES as readonly string[]).includes(v);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.redirect(new URL("/login?reason=config", url.origin));
  }

  const cookieStore = await cookies();
  const redirectUrl = new URL(next, url.origin);
  const res = NextResponse.redirect(redirectUrl);
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?reason=callback&message=${encodeURIComponent(error.message)}`,
          url.origin,
        ),
      );
    }
    return res;
  }

  const token_hash = url.searchParams.get("token_hash");
  const typeRaw = url.searchParams.get("type");
  if (token_hash && typeRaw && isEmailOtpType(typeRaw)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: typeRaw });
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?reason=invite_link&message=${encodeURIComponent(error.message)}`,
          url.origin,
        ),
      );
    }
    return res;
  }

  return NextResponse.redirect(new URL("/login?reason=callback", url.origin));
}
