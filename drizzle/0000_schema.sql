-- Full app schema (public). Supabase Auth is in auth.* — not managed here.
-- Reference data (`plans`, `permissions`): run `npm run db:seed` or rely on app sync on signup.

CREATE TYPE "public"."subscription_status" AS ENUM (
  'trialing',
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'unpaid',
  'paused'
);

CREATE TYPE "public"."deal_status" AS ENUM (
  'draft',
  'negotiation',
  'won',
  'lost',
  'archived'
);

CREATE TYPE "public"."promo_discount_kind" AS ENUM ('percent', 'fixed_cents');
CREATE TYPE "public"."promo_usage_mode" AS ENUM ('single_use', 'multi_use');

CREATE TABLE "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "stripe_price_id" text,
  CONSTRAINT "plans_slug_unique" UNIQUE ("slug"),
  CONSTRAINT "plans_stripe_price_id_unique" UNIQUE ("stripe_price_id")
);

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "plan_id" uuid NOT NULL,
  CONSTRAINT "organizations_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans" ("id") ON DELETE restrict ON UPDATE no action
);

CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "description" text,
  CONSTRAINT "permissions_code_unique" UNIQUE ("code")
);

CREATE TABLE "products" (
  "id" text PRIMARY KEY NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "image" text,
  "metadata" jsonb
);

CREATE TABLE "prices" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "description" text,
  "unit_amount" bigint,
  "currency" text DEFAULT 'usd' NOT NULL,
  "type" text NOT NULL,
  "interval" text,
  "interval_count" integer,
  "trial_period_days" integer,
  "metadata" jsonb,
  CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "slug" text,
  CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "roles_organization_id_slug_unique" ON "roles" USING btree ("organization_id", "slug");

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "full_name" text NOT NULL,
  "avatar_url" text,
  "organization_id" uuid NOT NULL,
  "role_id" uuid,
  "may_create_own_organization" boolean DEFAULT false NOT NULL,
  CONSTRAINT "profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "profiles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "stripe_customer_id" text NOT NULL,
  CONSTRAINT "customers_organization_id_unique" UNIQUE ("organization_id"),
  CONSTRAINT "customers_stripe_customer_id_unique" UNIQUE ("stripe_customer_id"),
  CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "status" "subscription_status" NOT NULL,
  "price_id" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created" timestamp with time zone DEFAULT now() NOT NULL,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "cancel_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "trial_start" timestamp with time zone,
  "trial_end" timestamp with time zone,
  "metadata" jsonb,
  CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "subscriptions_price_id_prices_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."prices" ("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX "subscriptions_organization_id_idx" ON "subscriptions" ("organization_id");

CREATE TABLE "organization_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "organization_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "organization_memberships_user_org_unique" ON "organization_memberships" ("user_id", "organization_id");

CREATE TABLE "organization_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "organization_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "invited_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "organization_invites_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "organization_invites_org_email_unique" ON "organization_invites" ("organization_id", "email");

CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "projects_one_default_per_org" ON "projects" ("organization_id") WHERE "is_default" = true;

CREATE INDEX "projects_organization_id_idx" ON "projects" ("organization_id");

CREATE TABLE "deals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" "deal_status" DEFAULT 'draft' NOT NULL,
  "start_at" timestamp with time zone,
  "end_at" timestamp with time zone,
  "amount_note" text,
  "created_by" uuid NOT NULL,
  "pdf_storage_path" text,
  "pdf_original_name" text,
  "pdf_bytes" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "deals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects" ("id") ON DELETE restrict ON UPDATE no action
);

CREATE INDEX "deals_project_id_idx" ON "deals" ("project_id");

CREATE TABLE "promo_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "discount_kind" "public"."promo_discount_kind" NOT NULL,
  "discount_percent" integer,
  "discount_amount_cents" integer,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "usage_mode" "public"."promo_usage_mode" NOT NULL DEFAULT 'multi_use',
  "max_redemptions" integer,
  "redemption_count" integer NOT NULL DEFAULT 0,
  "once_per_user" boolean NOT NULL DEFAULT true,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "promo_codes_code_unique" UNIQUE ("code")
);

CREATE TABLE "promo_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "promo_code_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "stripe_checkout_session_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "promo_redemptions_promo_code_id_promo_codes_id_fk"
    FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes" ("id")
    ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "promo_redemptions_stripe_checkout_session_id_unique" UNIQUE ("stripe_checkout_session_id")
);

CREATE INDEX "promo_redemptions_promo_user_idx"
  ON "promo_redemptions" ("promo_code_id", "user_id");
