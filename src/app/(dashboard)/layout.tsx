import { redirect } from "next/navigation";

import { DashboardDataProvider } from "@/components/providers/dashboard-data-provider";
import { DashboardClientChrome } from "@/components/layout/DashboardClientChrome";
import { getViewer, onboardingRedirectPath } from "@/lib/auth/viewer";
import { getOrganizationPlanSlug } from "@/lib/billing/plan-enforcement";
import { getPlanDefinitionBySlug } from "@/lib/billing/plan-limits";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }
  const setupPath = onboardingRedirectPath(viewer);
  if (setupPath) {
    redirect(setupPath);
  }
  const organizationName = viewer.profile?.organizationName ?? null;
  const orgId = viewer.profile?.organizationId;
  const planSlugFromProfile = viewer.profile?.organizationPlanSlug?.trim();
  const planSlug =
    planSlugFromProfile ||
    (orgId ? await getOrganizationPlanSlug(orgId) : null) ||
    "free";
  const brandingRemoval =
    getPlanDefinitionBySlug(planSlug).limits.brandingRemoval;
  const brandingFooter = brandingRemoval
    ? null
    : "Free plan — upgrade on Billing to remove this notice and unlock higher limits.";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <DashboardClientChrome organizationName={organizationName} />
      <div className="flex min-h-screen min-w-0 flex-col pl-0 md:pl-56">
        <DashboardDataProvider>
          <div className="flex-1">{children}</div>
        </DashboardDataProvider>
        {brandingFooter ? (
          <p className="border-t border-zinc-200 px-4 py-2 text-center text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {brandingFooter}
          </p>
        ) : null}
      </div>
    </div>
  );
}
