/**
 * Auth routes read the session via `cookies()` (Supabase SSR). Tell Next not to try
 * static prerender for them — avoids noisy `DYNAMIC_SERVER_USAGE` errors during `next build`.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
