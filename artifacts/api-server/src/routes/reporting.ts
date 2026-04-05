import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  orderLinesTable,
  productsTable,
  categoriesTable,
  paymentsTable,
  tablesTable,
  customersTable,
} from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/reporting/dashboard", verifyToken, async (req, res): Promise<void> => {
  const { dateFrom, dateTo, sessionId } = req.query as Record<string, string>;

  const conditions = [];
  if (sessionId) conditions.push(eq(ordersTable.sessionId, sessionId));
  if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(ordersTable.createdAt, new Date(dateTo)));
  const orderWhere = conditions.length > 0 ? and(...conditions) : undefined;

  // Get paid orders
  const paidConditions = [...conditions, eq(ordersTable.status, "PAID")];
  const paidWhere = and(...paidConditions);

  // Total orders
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(paidWhere);
  const totalOrders = totalResult?.count ?? 0;

  // Total revenue
  const [revenueResult] = await db
    .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float` })
    .from(paymentsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, paymentsTable.orderId))
    .where(paidWhere);
  const totalRevenue = revenueResult?.total ?? 0;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Sales by day
  const salesByDayRaw = await db
    .select({
      date: sql<string>`to_char(${ordersTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      amount: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float`,
    })
    .from(ordersTable)
    .leftJoin(paymentsTable, eq(paymentsTable.orderId, ordersTable.id))
    .where(paidWhere)
    .groupBy(sql`to_char(${ordersTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${ordersTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  // Sales by category
  const salesByCategoryRaw = await db
    .select({
      categoryId: categoriesTable.id,
      name: categoriesTable.name,
      color: categoriesTable.color,
      amount: sql<number>`coalesce(sum(${orderLinesTable.total}), 0)::float`,
    })
    .from(orderLinesTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderLinesTable.orderId))
    .innerJoin(productsTable, eq(productsTable.id, orderLinesTable.productId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
    .where(paidWhere)
    .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.color)
    .orderBy(sql`sum(${orderLinesTable.total}) DESC`);

  const totalCatAmount = salesByCategoryRaw.reduce((sum, c) => sum + c.amount, 0);
  const salesByCategory = salesByCategoryRaw.map((c) => ({
    ...c,
    percentage: totalCatAmount > 0 ? Math.round((c.amount / totalCatAmount) * 100) : 0,
  }));

  // Top products
  const topProducts = await db
    .select({
      productId: productsTable.id,
      name: productsTable.name,
      qty: sql<number>`sum(${orderLinesTable.qty})::int`,
      revenue: sql<number>`sum(${orderLinesTable.total})::float`,
    })
    .from(orderLinesTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderLinesTable.orderId))
    .innerJoin(productsTable, eq(productsTable.id, orderLinesTable.productId))
    .where(paidWhere)
    .groupBy(productsTable.id, productsTable.name)
    .orderBy(sql`sum(${orderLinesTable.total}) DESC`)
    .limit(10);

  // Top categories
  const topCategories = await db
    .select({
      categoryId: categoriesTable.id,
      name: categoriesTable.name,
      color: categoriesTable.color,
      revenue: sql<number>`sum(${orderLinesTable.total})::float`,
    })
    .from(orderLinesTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderLinesTable.orderId))
    .innerJoin(productsTable, eq(productsTable.id, orderLinesTable.productId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
    .where(paidWhere)
    .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.color)
    .orderBy(sql`sum(${orderLinesTable.total}) DESC`)
    .limit(10);

  // Recent orders
  const recentOrdersRaw = await db
    .select()
    .from(ordersTable)
    .where(paidWhere)
    .orderBy(ordersTable.createdAt)
    .limit(10);

  const recentOrders = await Promise.all(
    recentOrdersRaw.map(async (order) => {
      const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id));
      const total = lines.reduce((sum, l) => sum + l.total, 0);
      const table = order.tableId ? (await db.select().from(tablesTable).where(eq(tablesTable.id, order.tableId)).limit(1))[0] ?? null : null;
      const customer = order.customerId ? (await db.select().from(customersTable).where(eq(customersTable.id, order.customerId)).limit(1))[0] ?? null : null;
      return { ...order, total, table, customer };
    })
  );

  res.json({
    totalOrders,
    avgOrder,
    totalRevenue,
    salesByDay: salesByDayRaw,
    salesByCategory,
    topProducts,
    topCategories,
    recentOrders,
  });
});

// ─── Today's sales per product (for PDF report) ─────────────────────────────
router.get("/reporting/today-products", verifyToken, async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const paidToday = and(
    eq(ordersTable.status, "PAID"),
    gte(ordersTable.createdAt, startOfDay),
    lte(ordersTable.createdAt, endOfDay),
  );

  const [totals] = await db
    .select({
      totalOrders: sql<number>`count(distinct ${ordersTable.id})::int`,
      totalRevenue: sql<number>`coalesce(sum(${orderLinesTable.total}), 0)::float`,
    })
    .from(ordersTable)
    .innerJoin(orderLinesTable, eq(orderLinesTable.orderId, ordersTable.id))
    .where(paidToday);

  const products = await db
    .select({
      productId: productsTable.id,
      name: productsTable.name,
      category: categoriesTable.name,
      qty: sql<number>`sum(${orderLinesTable.qty})::int`,
      revenue: sql<number>`sum(${orderLinesTable.total})::float`,
    })
    .from(orderLinesTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderLinesTable.orderId))
    .innerJoin(productsTable, eq(productsTable.id, orderLinesTable.productId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
    .where(paidToday)
    .groupBy(productsTable.id, productsTable.name, categoriesTable.name)
    .orderBy(sql`sum(${orderLinesTable.total}) DESC`);

  const totalOrders = totals?.totalOrders ?? 0;
  const totalRevenue = totals?.totalRevenue ?? 0;

  res.json({
    date: now.toISOString(),
    totalOrders,
    totalRevenue,
    avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    products,
  });
});

// ─── Payments report ─────────────────────────────────────────────────────────
router.get("/reporting/payments", verifyToken, async (req, res): Promise<void> => {
  const { dateFrom, dateTo, method, preset } = req.query as Record<string, string>;

  // Resolve date range from preset or explicit dates
  function startOfDay(d: Date) {
    const r = new Date(d); r.setUTCHours(0, 0, 0, 0); return r;
  }
  function endOfDay(d: Date) {
    const r = new Date(d); r.setUTCHours(23, 59, 59, 999); return r;
  }

  let from: Date | null = null;
  let to: Date | null = null;
  const now = new Date();

  if (preset === "today") {
    from = startOfDay(now); to = endOfDay(now);
  } else if (preset === "yesterday") {
    const y = new Date(now); y.setUTCDate(y.getUTCDate() - 1);
    from = startOfDay(y); to = endOfDay(y);
  } else if (preset === "last7") {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - 6);
    from = startOfDay(d); to = endOfDay(now);
  } else if (preset === "last30") {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - 29);
    from = startOfDay(d); to = endOfDay(now);
  } else if (preset === "thisMonth") {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    to = endOfDay(now);
  } else {
    if (dateFrom) from = new Date(dateFrom);
    if (dateTo) to = endOfDay(new Date(dateTo));
  }

  const conditions: any[] = [];
  if (from) conditions.push(gte(paymentsTable.createdAt, from));
  if (to) conditions.push(lte(paymentsTable.createdAt, to));
  if (method && method !== "ALL") conditions.push(eq(paymentsTable.method, method as "CASH" | "UPI" | "DIGITAL"));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Totals
  const [summary] = await db
    .select({
      total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentsTable)
    .where(where);

  // Breakdown by method (always unfiltered by method so all 3 show)
  const methodConditions = conditions.filter(
    (c) => c !== conditions.find((x: any) => x === (method && method !== "ALL" ? conditions[conditions.length - 1] : null))
  );
  const baseConditions: any[] = [];
  if (from) baseConditions.push(gte(paymentsTable.createdAt, from));
  if (to) baseConditions.push(lte(paymentsTable.createdAt, to));
  const baseWhere = baseConditions.length > 0 ? and(...baseConditions) : undefined;

  const byMethod = await db
    .select({
      method: paymentsTable.method,
      total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(paymentsTable)
    .where(baseWhere)
    .groupBy(paymentsTable.method)
    .orderBy(sql`sum(${paymentsTable.amount}) DESC`);

  // By day
  const byDay = await db
    .select({
      date: sql<string>`to_char(${paymentsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float`,
      count: sql<number>`count(*)::int`,
      cash: sql<number>`coalesce(sum(case when ${paymentsTable.method} = 'CASH' then ${paymentsTable.amount} else 0 end), 0)::float`,
      upi: sql<number>`coalesce(sum(case when ${paymentsTable.method} = 'UPI' then ${paymentsTable.amount} else 0 end), 0)::float`,
      digital: sql<number>`coalesce(sum(case when ${paymentsTable.method} = 'DIGITAL' then ${paymentsTable.amount} else 0 end), 0)::float`,
    })
    .from(paymentsTable)
    .where(where)
    .groupBy(sql`to_char(${paymentsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${paymentsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  // Individual transactions
  const transactions = await db
    .select({
      id: paymentsTable.id,
      amount: paymentsTable.amount,
      method: paymentsTable.method,
      createdAt: paymentsTable.createdAt,
      orderId: paymentsTable.orderId,
      tableNumber: tablesTable.tableNumber,
    })
    .from(paymentsTable)
    .leftJoin(ordersTable, eq(ordersTable.id, paymentsTable.orderId))
    .leftJoin(tablesTable, eq(tablesTable.id, ordersTable.tableId))
    .where(where)
    .orderBy(desc(paymentsTable.createdAt))
    .limit(200);

  res.json({
    summary: { total: summary?.total ?? 0, count: summary?.count ?? 0 },
    byMethod,
    byDay,
    transactions,
    filters: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null, method: method ?? "ALL", preset: preset ?? "custom" },
  });
});

export default router;
