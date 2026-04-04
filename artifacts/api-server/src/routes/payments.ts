import { Router, type IRouter } from "express";
import { db, paymentsTable, ordersTable, posSessionsTable, posConfigTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";
import { io } from "../index";

const router: IRouter = Router();

router.get("/payments", verifyToken, async (req, res): Promise<void> => {
  const { sessionId, dateFrom, dateTo } = req.query as { sessionId?: string; dateFrom?: string; dateTo?: string };

  let query = db
    .select({
      id: paymentsTable.id,
      orderId: paymentsTable.orderId,
      method: paymentsTable.method,
      amount: paymentsTable.amount,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .$dynamic();

  const conditions = [];

  if (sessionId) {
    const orderIds = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(eq(ordersTable.sessionId, sessionId));
    if (orderIds.length > 0) {
      conditions.push(sql`${paymentsTable.orderId} IN (${sql.join(orderIds.map((o) => sql`${o.id}`), sql`, `)})`);
    }
  }

  if (dateFrom) conditions.push(gte(paymentsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(paymentsTable.createdAt, new Date(dateTo)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const payments = await query.orderBy(paymentsTable.createdAt);
  res.json(payments);
});

router.post("/payments", verifyToken, async (req, res): Promise<void> => {
  const { orderId, method, amount } = req.body as {
    orderId: string;
    method: "CASH" | "DIGITAL" | "UPI";
    amount: number;
  };

  if (!orderId || !method || amount == null) {
    res.status(400).json({ error: "orderId, method, and amount are required" });
    return;
  }

  const [payment] = await db
    .insert(paymentsTable)
    .values({ orderId, method, amount })
    .returning();

  // Mark order as PAID
  await db
    .update(ordersTable)
    .set({ status: "PAID" })
    .where(eq(ordersTable.id, orderId));

  // Get order to update session's lastSaleAmount
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (order) {
    const [totalResult] = await db
      .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float` })
      .from(paymentsTable)
      .where(eq(paymentsTable.orderId, orderId));

    const [session] = await db.select().from(posSessionsTable).where(eq(posSessionsTable.id, order.sessionId)).limit(1);
    if (session) {
      await db
        .update(posConfigTable)
        .set({ lastSaleAmount: totalResult?.total ?? amount })
        .where(eq(posConfigTable.id, session.posConfigId));
    }
  }

  // Emit payment:confirmed event
  io.emit("payment:confirmed", { orderId, amount, method });

  res.status(201).json(payment);
});

export default router;
