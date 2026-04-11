import { revalidateTag } from "next/cache";

/** Next.js `unstable_cache` tags; pair with `revalidateTag` in server actions. */
export const TAG_PERMISSIONS_CATALOG = "permissions-catalog";

export function tagDashboardDeals(organizationId: string) {
  return `dashboard-deals-${organizationId}`;
}

export function tagDashboardOrganization(organizationId: string) {
  return `dashboard-organization-${organizationId}`;
}

export function tagDashboardRoles(organizationId: string) {
  return `dashboard-roles-${organizationId}`;
}

/** Default stale time; after this, Next can serve stale and refresh in the background. */
export const DASHBOARD_DATA_REVALIDATE_SECONDS = 30;

export function revalidateDashboardDealData(organizationId: string) {
  revalidateTag(tagDashboardDeals(organizationId));
  revalidateTag(tagDashboardOrganization(organizationId));
}

export function revalidateDashboardOrganizationData(organizationId: string) {
  revalidateTag(tagDashboardOrganization(organizationId));
}

export function revalidateDashboardRolesData(organizationId: string) {
  revalidateTag(tagDashboardRoles(organizationId));
  revalidateTag(tagDashboardOrganization(organizationId));
}

export function revalidatePermissionsCatalog() {
  revalidateTag(TAG_PERMISSIONS_CATALOG);
}

/** After org create/switch or other wide changes affecting deals + org + roles UIs. */
export function revalidateAllDashboardForOrganization(organizationId: string) {
  revalidateTag(tagDashboardDeals(organizationId));
  revalidateTag(tagDashboardOrganization(organizationId));
  revalidateTag(tagDashboardRoles(organizationId));
}
