import { OrganizationPageSwr } from "@/components/dashboard/organization-page-swr";
import { DashboardPageShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default function OrganizationPage() {
  return (
    <DashboardPageShell title="Organization">
      <OrganizationPageSwr />
    </DashboardPageShell>
  );
}
