import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const floorsTable = pgTable("floors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  posId: text("pos_id").notNull(),
});

export const tablesTable = pgTable("tables", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  floorId: text("floor_id").notNull(),
  tableNumber: text("table_number").notNull(),
  seats: integer("seats").notNull().default(4),
  active: boolean("active").notNull().default(true),
  token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  sessionStartedAt: timestamp("session_started_at"),
});

export const insertFloorSchema = createInsertSchema(floorsTable).omit({ id: true });
export type InsertFloor = z.infer<typeof insertFloorSchema>;
export type Floor = typeof floorsTable.$inferSelect;

export const insertTableSchema = createInsertSchema(tablesTable).omit({ id: true, token: true });
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Table = typeof tablesTable.$inferSelect;
