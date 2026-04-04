import { pgTable, text, integer, real, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusEnum = pgEnum("order_status", ["DRAFT", "PAID", "CANCELLED"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["TO_COOK", "PREPARING", "COMPLETED"]);

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id").notNull(),
  tableId: text("table_id"),
  customerId: text("customer_id"),
  status: orderStatusEnum("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLinesTable = pgTable("order_lines", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull(),
  productId: text("product_id").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: real("unit_price").notNull(),
  discountPct: real("discount_pct").notNull().default(0),
  tax: real("tax").notNull(),
  subTotal: real("sub_total").notNull(),
  total: real("total").notNull(),
  note: text("note"),
});

export const paymentsTable = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull(),
  method: text("method", { enum: ["CASH", "DIGITAL", "UPI"] }).notNull(),
  amount: real("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kitchenTicketsTable = pgTable("kitchen_tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().unique(),
  status: ticketStatusEnum("status").notNull().default("TO_COOK"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kitchenTicketItemsTable = pgTable("kitchen_ticket_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id").notNull(),
  orderLineId: text("order_line_id").notNull(),
  prepared: boolean("prepared").notNull().default(false),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const insertOrderLineSchema = createInsertSchema(orderLinesTable).omit({ id: true });
export type InsertOrderLine = z.infer<typeof insertOrderLineSchema>;
export type OrderLine = typeof orderLinesTable.$inferSelect;

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

export const insertKitchenTicketSchema = createInsertSchema(kitchenTicketsTable).omit({ id: true, createdAt: true });
export type InsertKitchenTicket = z.infer<typeof insertKitchenTicketSchema>;
export type KitchenTicket = typeof kitchenTicketsTable.$inferSelect;

export const insertKitchenTicketItemSchema = createInsertSchema(kitchenTicketItemsTable).omit({ id: true });
export type InsertKitchenTicketItem = z.infer<typeof insertKitchenTicketItemSchema>;
export type KitchenTicketItem = typeof kitchenTicketItemsTable.$inferSelect;
