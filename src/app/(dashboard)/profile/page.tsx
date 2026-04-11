import type { ReactNode } from "react";

import {
  DashboardPageShell,
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import {
  formatDate,
  ProfileDetailRows,
} from "@/components/profile/profile-detail-rows";
import { getViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

async function ProfilePageData() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <DashboardPanel title="Profile" description="Sign in to view your details.">
        <p className="text-sm text-zinc-600">No user session.</p>
      </DashboardPanel>
    );
  }

  const { user, profile } = viewer;

  const avatarValue: ReactNode = profile?.avatarUrl ? (
    <a
      href={profile.avatarUrl}
      className="break-all text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      target="_blank"
      rel="noopener noreferrer"
    >
      {profile.avatarUrl}
    </a>
  ) : (
    "—"
  );

  const rows: { label: string; value: ReactNode }[] = [
    { label: "User ID", value: user.id },
    { label: "Email", value: user.email ?? "—" },
    { label: "Phone", value: user.phone ?? "—" },
    { label: "Created at", value: formatDate(user.created_at) },
    { label: "Updated at", value: formatDate(user.updated_at) },
    { label: "Last sign in", value: formatDate(user.last_sign_in_at) },
    { label: "Full name", value: profile?.fullName ?? "—" },
    { label: "Avatar URL", value: avatarValue },
    { label: "Role name", value: profile?.roleName ?? "—" },
  ];

  return (
    <DashboardPanel
      title="Your profile"
      description="Your account and identity. Billing plan for the workspace is on the Organization page."
    >
      <ProfileDetailRows rows={rows} />
    </DashboardPanel>
  );
}

export default function ProfilePage() {
  return (
    <DashboardPageShell title="Profile">
      <ProfilePageData />
    </DashboardPageShell>
  );
}
