import { pgTable, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  categoryId: text("category_id").notNull(),
  price: real("price").notNull(),
  unit: text("unit").notNull().default("Unit"),
  tax: real("tax").notNull().default(5),
  description: text("description"),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productVariantsTable = pgTable("product_variants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull(),
  attribute: text("attribute").notNull(),
  value: text("value").notNull(),
  extraPrice: real("extra_price").notNull().default(0),
  unit: text("unit").notNull().default("Unit"),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

export const insertVariantSchema = createInsertSchema(productVariantsTable).omit({ id: true });
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
