import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { prices, products, subscriptions } from "@/db/schema";

/** Matches the usual Supabase pattern: one active/trialing row with nested price + product. */
export async function getOrganizationSubscription(organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      subscription: subscriptions,
      price: prices,
      product: products,
    })
    .from(subscriptions)
    .leftJoin(prices, eq(subscriptions.price_id, prices.id))
    .leftJoin(products, eq(prices.product_id, products.id))
    .where(
      and(
        eq(subscriptions.organization_id, organizationId),
        inArray(subscriptions.status, ["trialing", "active"]),
      ),
    )
    .orderBy(desc(subscriptions.created))
    .limit(1);

  if (!row) return null;
  return {
    ...row.subscription,
    price: row.price,
    product: row.product,
  };
}
