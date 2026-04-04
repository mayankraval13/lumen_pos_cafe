import { pgTable, text, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentTypeEnum = pgEnum("payment_type", ["CASH", "DIGITAL", "UPI"]);

export const paymentMethodsTable = pgTable("payment_methods", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: paymentTypeEnum("name").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  upiId: text("upi_id"),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethodsTable).omit({ id: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
