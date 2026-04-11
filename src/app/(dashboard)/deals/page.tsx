import {
  DashboardPageShell,
} from "@/components/layout/dashboard-shell";
import { DealsPageSwr } from "@/components/dashboard/deals-page-swr";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ project?: string }> };

export default async function DealsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialProjectQuery = sp.project ?? "";

  return (
    <DashboardPageShell title="Deals">
      <DealsPageSwr initialProjectQuery={initialProjectQuery} />
    </DashboardPageShell>
  );
}
