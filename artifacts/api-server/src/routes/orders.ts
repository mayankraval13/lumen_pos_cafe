import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  orderLinesTable,
  productsTable,
  categoriesTable,
  customersTable,
  tablesTable,
  paymentsTable,
} from "@workspace/db";
import { eq, and, sql, gte, lte, inArray, desc } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";
import { io } from "../index";

const router: IRouter = Router();

async function getOrderWithDetails(orderId: string) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return null;

  const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, orderId));

  const linesWithProducts = await Promise.all(
    lines.map(async (line) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, line.productId)).limit(1);
      let category = null;
      if (product) {
        [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1);
      }
      return {
        ...line,
        product: product ? { ...product, category: category ?? null, variants: [] } : null,
      };
    })
  );

  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.orderId, orderId));
  const table = order.tableId ? (await db.select().from(tablesTable).where(eq(tablesTable.id, order.tableId)).limit(1))[0] ?? null : null;
  const customer = order.customerId ? (await db.select().from(customersTable).where(eq(customersTable.id, order.customerId)).limit(1))[0] ?? null : null;

  return { ...order, lines: linesWithProducts, payments, table, customer };
}

function computeTotal(lines: { total: number }[]): number {
  return lines.reduce((sum, l) => sum + l.total, 0);
}

router.get("/orders", verifyToken, async (req, res): Promise<void> => {
  const { sessionId, status, customerId, dateFrom, dateTo, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (sessionId) conditions.push(eq(ordersTable.sessionId, sessionId));
  if (status) conditions.push(eq(ordersTable.status, status as "DRAFT" | "PAID"));
  if (customerId) conditions.push(eq(ordersTable.customerId, customerId));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(ordersTable.createdAt, to));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orders = await db
    .select()
    .from(ordersTable)
    .where(whereClause)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const ordersWithDetails = await Promise.all(
    orders.map(async (order) => {
      const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id));
      const total = computeTotal(lines);
      const linesCount = lines.length;
      const table = order.tableId
        ? (await db.select().from(tablesTable).where(eq(tablesTable.id, order.tableId)).limit(1))[0] ?? null
        : null;
      const customer = order.customerId
        ? (await db.select().from(customersTable).where(eq(customersTable.id, order.customerId)).limit(1))[0] ?? null
        : null;
      const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.orderId, order.id));
      const paymentMethod = payments.length > 0 ? payments[0]!.method : null;
      return { ...order, total, linesCount, table, customer, paymentMethod };
    })
  );

  res.json(ordersWithDetails);
});

router.post("/orders", verifyToken, async (req, res): Promise<void> => {
  const { sessionId, tableId, customerId } = req.body as {
    sessionId: string;
    tableId?: string;
    customerId?: string;
  };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({ sessionId, tableId, customerId, status: "DRAFT" })
    .returning();

  res.status(201).json({ ...order, lines: [], payments: [], table: null, customer: null });
});

router.get("/orders/table/:tableId", verifyToken, async (req, res): Promise<void> => {
  const tableId = Array.isArray(req.params.tableId) ? req.params.tableId[0] : req.params.tableId;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.tableId, tableId), eq(ordersTable.status, "DRAFT")))
    .orderBy(ordersTable.createdAt)
    .limit(1);

  if (!order) {
    res.json(null);
    return;
  }

  const full = await getOrderWithDetails(order.id);
  res.json(full);
});

router.get("/orders/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const order = await getOrderWithDetails(id);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(order);
});

router.put("/orders/:id/status", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status: "DRAFT" | "PAID" };

  const [updated] = await db
    .update(ordersTable)
    .set({ status })
    .where(eq(ordersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const full = await getOrderWithDetails(id);
  res.json(full);
});

router.delete("/orders/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status !== "DRAFT") {
    res.status(400).json({ error: "Can only delete DRAFT orders" });
    return;
  }

  await db.delete(orderLinesTable).where(eq(orderLinesTable.orderId, id));
  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  res.sendStatus(204);
});

// Order lines
router.post("/orders/:id/lines", verifyToken, async (req, res): Promise<void> => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { productId, qty = 1, note } = req.body as { productId: string; qty?: number; note?: string };

  if (!productId) {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const unitPrice = product.price;
  const tax = product.tax;
  const subTotal = unitPrice * qty;
  const total = subTotal * (1 + tax / 100);

  const [line] = await db
    .insert(orderLinesTable)
    .values({ orderId, productId, qty, unitPrice, tax, subTotal, total, note })
    .returning();

  const category = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1);

  const lineWithProduct = {
    ...line,
    product: { ...product, category: category[0] ?? null, variants: [] },
  };

  // Emit order:updated event
  const full = await getOrderWithDetails(orderId);
  if (full) {
    io.emit("order:updated", { order: full });
  }

  res.status(201).json(lineWithProduct);
});

router.put("/orders/:id/lines/:lineId", verifyToken, async (req, res): Promise<void> => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const lineId = Array.isArray(req.params.lineId) ? req.params.lineId[0] : req.params.lineId;
  const { qty, note, unitPrice, discountPct } = req.body as {
    qty?: number;
    note?: string;
    unitPrice?: number;
    discountPct?: number;
  };

  const [existingLine] = await db.select().from(orderLinesTable).where(eq(orderLinesTable.id, lineId)).limit(1);
  if (!existingLine) {
    res.status(404).json({ error: "Order line not found" });
    return;
  }

  const newQty = qty ?? existingLine.qty;
  const newUnitPrice = unitPrice != null ? unitPrice : existingLine.unitPrice;
  const newDiscountPct = discountPct != null ? Math.min(100, Math.max(0, discountPct)) : (existingLine.discountPct ?? 0);
  const rawSubTotal = newUnitPrice * newQty;
  const discountAmt = rawSubTotal * (newDiscountPct / 100);
  const subTotal = rawSubTotal - discountAmt;
  const total = subTotal * (1 + existingLine.tax / 100);

  const updateData: Record<string, unknown> = { qty: newQty, unitPrice: newUnitPrice, discountPct: newDiscountPct, subTotal, total };
  if (note !== undefined) updateData.note = note;

  const [updated] = await db
    .update(orderLinesTable)
    .set(updateData)
    .where(eq(orderLinesTable.id, lineId))
    .returning();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, updated!.productId)).limit(1);
  const category = product ? await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1) : [];

  const lineWithProduct = {
    ...updated,
    product: product ? { ...product, category: category[0] ?? null, variants: [] } : null,
  };

  const full = await getOrderWithDetails(orderId);
  if (full) {
    io.emit("order:updated", { order: full });
  }

  res.json(lineWithProduct);
});

router.delete("/orders/:id/lines/:lineId", verifyToken, async (req, res): Promise<void> => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const lineId = Array.isArray(req.params.lineId) ? req.params.lineId[0] : req.params.lineId;

  await db.delete(orderLinesTable).where(eq(orderLinesTable.id, lineId));

  const full = await getOrderWithDetails(orderId);
  if (full) {
    io.emit("order:updated", { order: full });
  }

  res.sendStatus(204);
});

export default router;
