import { RolesPageSwr } from "@/components/dashboard/roles-page-swr";
import { DashboardPageShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default function RolesPage() {
  return (
    <DashboardPageShell title="Roles">
      <RolesPageSwr />
    </DashboardPageShell>
  );
}
