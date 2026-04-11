import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * NOTE: Supabase manages the `auth.users` table.
 * Our `profiles.id` matches `auth.users.id` (same UUID), but we intentionally
 * don’t create an FK constraint here so Drizzle migrations stay minimal and
 * don’t try to manage Supabase’s internal auth schema.
 */

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "unpaid",
  "paused",
]);

/** Lifecycle of a commercial deal. */
export const dealStatusEnum = pgEnum("deal_status", [
  "draft",
  "negotiation",
  "won",
  "lost",
  "archived",
]);

/** App plan tier; `free` has no Stripe price. Paid tiers set `stripe_price_id` (sync with Stripe Price id). */
export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  stripe_price_id: text("stripe_price_id").unique(),
});

export const promoDiscountKindEnum = pgEnum("promo_discount_kind", [
  "percent",
  "fixed_cents",
]);

/** `single_use` = one successful redemption ever; `multi_use` with optional `max_redemptions`. */
export const promoUsageModeEnum = pgEnum("promo_usage_mode", [
  "single_use",
  "multi_use",
]);

export const promo_codes = pgTable("promo_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  discount_kind: promoDiscountKindEnum("discount_kind").notNull(),
  discount_percent: integer("discount_percent"),
  discount_amount_cents: integer("discount_amount_cents"),
  valid_from: timestamp("valid_from", { withTimezone: true }),
  valid_until: timestamp("valid_until", { withTimezone: true }),
  usage_mode: promoUsageModeEnum("usage_mode").notNull().default("multi_use"),
  /** For `multi_use`: null = unlimited total redemptions. Ignored for `single_use` (treated as 1). */
  max_redemptions: integer("max_redemptions"),
  redemption_count: integer("redemption_count").notNull().default(0),
  once_per_user: boolean("once_per_user").notNull().default(true),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promo_redemptions = pgTable(
  "promo_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promo_code_id: uuid("promo_code_id")
      .notNull()
      .references(() => promo_codes.id, { onDelete: "restrict" }),
    user_id: uuid("user_id").notNull(),
    stripe_checkout_session_id: text("stripe_checkout_session_id").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    promoUserIdx: index("promo_redemptions_promo_user_idx").on(
      t.promo_code_id,
      t.user_id,
    ),
  }),
);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  plan_id: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict" }),
});

/** Synced from Stripe via webhooks. */
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  active: boolean("active").notNull().default(true),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

/** Synced from Stripe via webhooks. */
export const prices = pgTable("prices", {
  id: text("id").primaryKey(),
  product_id: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  description: text("description"),
  unit_amount: bigint("unit_amount", { mode: "number" }),
  currency: text("currency").notNull().default("usd"),
  type: text("type").notNull(),
  interval: text("interval"),
  interval_count: integer("interval_count"),
  trial_period_days: integer("trial_period_days"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

/** Global permission catalog (e.g. `property:create`, `members:invite`). */
export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").unique().notNull(),
  description: text("description"),
});

/** Roles belong to an organization; each org has its own role rows. */
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    is_system: boolean("is_system").notNull().default(false),
    /** Stable key for built-in roles: `admin` | `owner` | `manager`. */
    slug: text("slug"),
  },
  (t) => ({
    orgSlugUnique: uniqueIndex("roles_organization_id_slug_unique").on(
      t.organization_id,
      t.slug,
    ),
  }),
);

/** Role ↔ permission assignments. */
export const role_permissions = pgTable(
  "role_permissions",
  {
    role_id: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission_id: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.role_id, t.permission_id] }),
  }),
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  full_name: text("full_name").notNull(),
  avatar_url: text("avatar_url"),

  organization_id: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role_id: uuid("role_id").references(() => roles.id, { onDelete: "set null" }),
  /**
   * After accepting an invite: true until the user creates their own organization once.
   * Self-serve signup always false (org is created during onboarding).
   */
  may_create_own_organization: boolean("may_create_own_organization")
    .notNull()
    .default(false),
});

/** One Stripe customer per organization. */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stripe_customer_id: text("stripe_customer_id").notNull().unique(),
  },
  (t) => ({
    orgUnique: uniqueIndex("customers_organization_id_unique").on(
      t.organization_id,
    ),
  }),
);

/** Synced from Stripe via webhooks; ties organization to a price. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull(),
    price_id: text("price_id").references(() => prices.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    cancel_at_period_end: boolean("cancel_at_period_end").notNull().default(false),
    created: timestamp("created", { withTimezone: true }).notNull().defaultNow(),
    current_period_start: timestamp("current_period_start", {
      withTimezone: true,
    }),
    current_period_end: timestamp("current_period_end", { withTimezone: true }),
    ended_at: timestamp("ended_at", { withTimezone: true }),
    cancel_at: timestamp("cancel_at", { withTimezone: true }),
    canceled_at: timestamp("canceled_at", { withTimezone: true }),
    trial_start: timestamp("trial_start", { withTimezone: true }),
    trial_end: timestamp("trial_end", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => ({
    orgIdx: index("subscriptions_organization_id_idx").on(t.organization_id),
  }),
);

/**
 * User memberships across organizations.
 * `profiles.organization_id` / `profiles.role_id` store the currently active org context.
 */
export const organization_memberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id").notNull(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role_id: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userOrgUnique: uniqueIndex("organization_memberships_user_org_unique").on(
      t.user_id,
      t.organization_id,
    ),
  }),
);

/**
 * Pending email invites (shown as “Invited” on the Organization members table).
 * Row removed when the invitee completes onboarding → they appear as “Active”.
 */
export const organization_invites = pgTable(
  "organization_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role_id: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    invited_by_user_id: uuid("invited_by_user_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgEmailUnique: uniqueIndex("organization_invites_org_email_unique").on(
      t.organization_id,
      t.email,
    ),
  }),
);

/** Workspaces inside an organization; deals belong to one project. Plan limits cap project count. */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Exactly one default project per org (created with the organization). */
    is_default: boolean("is_default").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdx: index("projects_organization_id_idx").on(t.organization_id),
  }),
);

/**
 * Deals scoped to an organization and project.
 * Attachments live in Supabase Storage; `pdf_storage_path` is the object path inside the bucket.
 */
export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organization_id: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  project_id: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  status: dealStatusEnum("status").notNull().default("draft"),
  start_at: timestamp("start_at", { withTimezone: true }),
  end_at: timestamp("end_at", { withTimezone: true }),
  /** Optional human-readable amount, e.g. "1 200 000 ₽". */
  amount_note: text("amount_note"),
  created_by: uuid("created_by").notNull(),
  pdf_storage_path: text("pdf_storage_path"),
  pdf_original_name: text("pdf_original_name"),
  /** Attachment size in bytes (counts toward plan storage). */
  pdf_bytes: integer("pdf_bytes"),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  projectIdx: index("deals_project_id_idx").on(t.project_id),
}));
