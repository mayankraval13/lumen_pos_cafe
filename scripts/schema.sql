-- =============================================================================
-- Lumen POS Cafe — Full Database Schema
-- Generated from Drizzle ORM schema definitions
-- Run this against a fresh PostgreSQL database:
--   psql -d pos_cafe -f scripts/schema.sql
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
-- PostgreSQL 15+ supports CREATE TYPE IF NOT EXISTS; use DO blocks so PG14 and
-- common Docker images (postgres:14, etc.) work the same.
DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('ADMIN', 'CASHIER', 'WAITER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "payment_type" AS ENUM ('CASH', 'DIGITAL', 'UPI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "session_status" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "order_status" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ticket_status" AS ENUM ('TO_COOK', 'PREPARING', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "users" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"                TEXT NOT NULL,
  "email"               TEXT NOT NULL UNIQUE,
  "password"            TEXT NOT NULL,
  "role"                "role" NOT NULL DEFAULT 'CASHIER',
  "assigned_table_ids"  TEXT NOT NULL DEFAULT '[]',
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Product Categories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "product_categories" (
  "id"    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"  TEXT NOT NULL,
  "color" TEXT NOT NULL
);

-- ── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "products" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"         TEXT NOT NULL,
  "category_id"  TEXT NOT NULL,
  "price"        REAL NOT NULL,
  "unit"         TEXT NOT NULL DEFAULT 'Unit',
  "tax"          REAL NOT NULL DEFAULT 5,
  "description"  TEXT,
  "image_url"    TEXT,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Product Variants ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "product_id"  TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "attribute"   TEXT NOT NULL,
  "value"       TEXT NOT NULL,
  "extra_price" REAL NOT NULL DEFAULT 0,
  "unit"        TEXT NOT NULL DEFAULT 'Unit'
);

-- ── Payment Methods ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id"      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"    "payment_type" NOT NULL UNIQUE,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "upi_id"  TEXT
);

-- ── POS Config ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pos_config" (
  "id"                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"                     TEXT NOT NULL,
  "last_opened_at"           TIMESTAMPTZ,
  "last_sale_amount"         REAL NOT NULL DEFAULT 0,
  "allowed_payment_methods"  TEXT NOT NULL DEFAULT '["CASH","DIGITAL","UPI"]',
  "allowed_cashier_ids"      TEXT NOT NULL DEFAULT '[]',
  "allowed_waiter_ids"       TEXT NOT NULL DEFAULT '[]'
);

-- ── POS Sessions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "pos_sessions" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "pos_config_id" TEXT NOT NULL REFERENCES "pos_config"("id") ON DELETE CASCADE,
  "cashier_id"    TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opened_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closed_at"     TIMESTAMPTZ,
  "status"        "session_status" NOT NULL DEFAULT 'OPEN'
);

-- ── Floors ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "floors" (
  "id"     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"   TEXT NOT NULL,
  "pos_id" TEXT NOT NULL REFERENCES "pos_config"("id") ON DELETE CASCADE
);

-- ── Tables ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "tables" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "floor_id"           TEXT NOT NULL REFERENCES "floors"("id") ON DELETE CASCADE,
  "table_number"       TEXT NOT NULL,
  "seats"              INTEGER NOT NULL DEFAULT 4,
  "active"             BOOLEAN NOT NULL DEFAULT true,
  "token"              TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "session_started_at" TIMESTAMPTZ
);

-- ── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "customers" (
  "id"      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"    TEXT NOT NULL,
  "email"   TEXT,
  "phone"   TEXT,
  "address" TEXT,
  "city"    TEXT,
  "state"   TEXT,
  "country" TEXT NOT NULL DEFAULT 'India'
);

-- ── Orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "orders" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "session_id"  TEXT NOT NULL REFERENCES "pos_sessions"("id") ON DELETE CASCADE,
  "table_id"    TEXT REFERENCES "tables"("id") ON DELETE SET NULL,
  "customer_id" TEXT REFERENCES "customers"("id") ON DELETE SET NULL,
  "status"      "order_status" NOT NULL DEFAULT 'DRAFT',
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Order Lines ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "order_lines" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "order_id"     TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id"   TEXT NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "qty"          INTEGER NOT NULL,
  "unit_price"   REAL NOT NULL,
  "discount_pct" REAL NOT NULL DEFAULT 0,
  "tax"          REAL NOT NULL,
  "sub_total"    REAL NOT NULL,
  "total"        REAL NOT NULL,
  "note"         TEXT
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payments" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "order_id"   TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "method"     TEXT NOT NULL CHECK ("method" IN ('CASH','DIGITAL','UPI')),
  "amount"     REAL NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Kitchen Tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kitchen_tickets" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "order_id"   TEXT NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
  "status"     "ticket_status" NOT NULL DEFAULT 'TO_COOK',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Kitchen Ticket Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kitchen_ticket_items" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ticket_id"     TEXT NOT NULL REFERENCES "kitchen_tickets"("id") ON DELETE CASCADE,
  "order_line_id" TEXT NOT NULL REFERENCES "order_lines"("id") ON DELETE CASCADE,
  "prepared"      BOOLEAN NOT NULL DEFAULT false
);

-- ── Seed: default payment methods ─────────────────────────────────────────────
INSERT INTO "payment_methods" ("name", "enabled")
VALUES
  ('CASH', true),
  ('DIGITAL', true),
  ('UPI', true)
ON CONFLICT ("name") DO NOTHING;
