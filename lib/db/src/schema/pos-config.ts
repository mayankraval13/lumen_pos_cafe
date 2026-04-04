import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const posConfigTable = pgTable("pos_config", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  lastSaleAmount: real("last_sale_amount").notNull().default(0),
  allowedPaymentMethods: text("allowed_payment_methods").notNull().default('["CASH","DIGITAL","UPI"]'),
  allowedCashierIds: text("allowed_cashier_ids").notNull().default('[]'),
  allowedWaiterIds: text("allowed_waiter_ids").notNull().default('[]'),
});

export const sessionStatusEnum = pgEnum("session_status", ["OPEN", "CLOSED"]);

export const posSessionsTable = pgTable("pos_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  posConfigId: text("pos_config_id").notNull(),
  cashierId: text("cashier_id").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  status: sessionStatusEnum("status").notNull().default("OPEN"),
});

export const insertPosConfigSchema = createInsertSchema(posConfigTable).omit({ id: true });
export type InsertPosConfig = z.infer<typeof insertPosConfigSchema>;
export type PosConfig = typeof posConfigTable.$inferSelect;

export const insertPosSessionSchema = createInsertSchema(posSessionsTable).omit({ id: true, openedAt: true });
export type InsertPosSession = z.infer<typeof insertPosSessionSchema>;
export type PosSession = typeof posSessionsTable.$inferSelect;
