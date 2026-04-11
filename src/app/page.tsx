import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const linkBase =
  "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400";

const highlights = [
  "Next.js app with Supabase Auth (email/password, Google OAuth, invite links).",
  "Postgres + Drizzle with ready migrations and seed data for plans/permissions.",
  "Organization workspace flow with roles, member invites, billing, and profile pages.",
] as const;

const featurePills = ["Auth", "Organizations", "Invites", "Roles", "Billing"] as const;

const quickFacts = [
  { label: "Auth methods", value: "4 flows" },
  { label: "Database", value: "Postgres + Drizzle" },
  { label: "Ready to run", value: "migrate + dev" },
] as const;

export default async function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.08),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.14),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,0.1),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.18),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,0.16),transparent_40%)]"
      />

      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white"
          >
            SaaS Boilerplate
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className={cn(
                linkBase,
                "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
              )}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className={cn(
                linkBase,
                "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
              )}
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-0 flex flex-1 items-center px-4 py-14 sm:px-6">
        <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="text-center lg:text-left">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {featurePills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200"
                >
                  {pill}
                </span>
              ))}
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-white">
              Build your SaaS faster
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 lg:mx-0 dark:text-zinc-300">
              Production-ready starter with authentication, organization workspaces,
              member management, and billing foundations.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/register"
                className={cn(
                  linkBase,
                  "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
                )}
              >
                Create account
              </Link>
              <Link
                href="/login"
                className={cn(
                  linkBase,
                  "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
                )}
              >
                Sign in
              </Link>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {quickFacts.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-lg border border-zinc-200 bg-white/80 p-3 text-left dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {fact.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {fact.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-zinc-200/60 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-black/20">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
              What is included
            </h2>
            <ul className="mt-4 space-y-3">
              {highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-200"
                >
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-cyan-600 dark:bg-cyan-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
