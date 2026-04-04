import { Router, type IRouter } from "express";
import {
  db,
  tablesTable,
  floorsTable,
  posConfigTable,
  categoriesTable,
  productsTable,
  productVariantsTable,
  paymentMethodsTable,
  ordersTable,
  orderLinesTable,
  kitchenTicketsTable,
  kitchenTicketItemsTable,
  customersTable,
} from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { io } from "../index";

const router: IRouter = Router();

// In-memory store for pending payment requests (keyed by table token)
// Cleared when customer pays or a new session starts
interface PendingPaymentRequest {
  orderId: string;          // primary order id (kept for UI compat)
  orderIds: string[];       // ALL session order ids to be marked PAID
  amount: number;           // aggregate total across all session orders
  upiId: string | null;
  tableId: string;
  tableNumber: string;
  requestedAt: number;      // epoch ms, for TTL
  // split-bill fields (splitParts=1 means no split / full payment)
  splitParts: number;       // how many equal parts
  splitAmountEach: number;  // amount per part
  collectedParts: number;   // parts collected so far
  collectedAmount: number;  // total collected so far
  remainingAmount: number;  // still outstanding
}
const pendingPayments = new Map<string, PendingPaymentRequest>();
// TTL: 30 minutes
const PAYMENT_REQUEST_TTL_MS = 30 * 60 * 1000;

function cleanExpiredPayments() {
  const now = Date.now();
  for (const [token, req] of pendingPayments.entries()) {
    if (now - req.requestedAt > PAYMENT_REQUEST_TTL_MS) {
      pendingPayments.delete(token);
    }
  }
}

// Public: all floors + tables with live occupancy (used by customer display)
router.get("/public/tables", async (_req, res): Promise<void> => {
  const configs = await db.select().from(posConfigTable).orderBy(posConfigTable.name);

  const result = await Promise.all(
    configs.map(async (config) => {
      const floors = await db.select().from(floorsTable).where(eq(floorsTable.posId, config.id));

      const floorsWithTables = await Promise.all(
        floors.map(async (floor) => {
          const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, floor.id));

          const tablesWithStatus = await Promise.all(
            tables.map(async (table) => {
              const [activeOrder] = await db
                .select()
                .from(ordersTable)
                .where(and(eq(ordersTable.tableId, table.id), eq(ordersTable.status, "DRAFT")))
                .limit(1);
              return {
                ...table,
                status: (activeOrder ? "OCCUPIED" : "FREE") as "OCCUPIED" | "FREE",
                orderId: activeOrder?.id ?? null,
              };
            })
          );

          return { ...floor, posName: config.name, tables: tablesWithStatus };
        })
      );

      return { ...config, floors: floorsWithTables };
    })
  );

  res.json(result);
});

router.get("/self-order/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found for this token" });
    return;
  }

  const [floor] = await db.select().from(floorsTable).where(eq(floorsTable.id, table.floorId)).limit(1);
  const [pos] = floor ? await db.select().from(posConfigTable).where(eq(posConfigTable.id, floor.posId)).limit(1) : [null];

  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const productsRaw = await db.select().from(productsTable).orderBy(productsTable.name);
  const products = await Promise.all(
    productsRaw.map(async (product) => {
      const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1);
      const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, product.id));
      return { ...product, category: category ?? null, variants };
    })
  );

  const paymentMethods = await db.select().from(paymentMethodsTable);

  // Check if table already has an active order
  const [activeOrder] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.tableId, table.id), eq(ordersTable.status, "DRAFT")))
    .limit(1);

  res.json({
    tableId: table.id,
    tableNumber: table.tableNumber,
    floorName: floor?.name ?? "Floor",
    posName: pos?.name ?? "POS Cafe",
    tableToken: token,
    hasActiveOrder: !!activeOrder,
    activeOrderId: activeOrder?.id ?? null,
    categories,
    products,
    paymentMethods,
  });
});

// Customer self-identifies on arrival — creates or returns existing customer by phone
router.post("/self-order/:token/identify", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const { name, phone, email } = req.body as { name: string; phone?: string; email?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  let customer;
  if (phone?.trim()) {
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.phone, phone.trim()))
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(customersTable)
        .set({
          name: name.trim(),
          ...(email?.trim() ? { email: email.trim() } : {}),
        })
        .where(eq(customersTable.id, existing.id))
        .returning();
      customer = updated;
    }
  }

  if (!customer && email?.trim()) {
    const [existingByEmail] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, email.trim()))
      .limit(1);
    if (existingByEmail) {
      const [updated] = await db
        .update(customersTable)
        .set({
          name: name.trim(),
          ...(phone?.trim() ? { phone: phone.trim() } : {}),
        })
        .where(eq(customersTable.id, existingByEmail.id))
        .returning();
      customer = updated;
    }
  }

  if (!customer) {
    const [created] = await db
      .insert(customersTable)
      .values({
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      })
      .returning();
    customer = created;
  }

  io.emit("customer:updated", {
    customerId: customer.id,
    name: customer.name,
    source: "self-order",
  });

  res.json({ customerId: customer.id, name: customer.name, phone: customer.phone, email: customer.email });
});

router.post("/self-order/:token/order", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const { sessionId, lines, customerId } = req.body as {
    sessionId?: string;
    customerId?: string;
    lines: Array<{ productId: string; qty: number; note?: string }>;
  };

  if (!lines?.length) {
    res.status(400).json({ error: "lines are required" });
    return;
  }

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  // Find active session
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    const { posSessionsTable } = await import("@workspace/db");
    const { eq: eqFn } = await import("drizzle-orm");
    const [session] = await db
      .select()
      .from(posSessionsTable)
      .where(eqFn(posSessionsTable.status, "OPEN"))
      .limit(1);
    activeSessionId = session?.id;
  }

  if (!activeSessionId) {
    res.status(400).json({ error: "No active session. Please contact staff to open a session." });
    return;
  }

  // Stamp session start time on the table the first time an order is placed this session
  if (!table.sessionStartedAt) {
    await db
      .update(tablesTable)
      .set({ sessionStartedAt: new Date() })
      .where(eq(tablesTable.id, table.id));
  }

  // Create order
  const [order] = await db
    .insert(ordersTable)
    .values({ sessionId: activeSessionId, tableId: table.id, status: "DRAFT", ...(customerId ? { customerId } : {}) })
    .returning();

  // Add order lines
  const createdLines = await Promise.all(
    lines.map(async ({ productId, qty, note }) => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
      if (!product) return null;

      const unitPrice = product.price;
      const tax = product.tax;
      const subTotal = unitPrice * qty;
      const total = subTotal * (1 + tax / 100);

      const [line] = await db
        .insert(orderLinesTable)
        .values({ orderId: order!.id, productId, qty, unitPrice, tax, subTotal, total, note })
        .returning();
      return line;
    })
  );

  const validLines = createdLines.filter(Boolean);

  // Auto-create kitchen ticket
  const [ticket] = await db
    .insert(kitchenTicketsTable)
    .values({ orderId: order!.id, status: "TO_COOK" })
    .returning();

  await Promise.all(
    validLines.map((line) =>
      db.insert(kitchenTicketItemsTable).values({ ticketId: ticket!.id, orderLineId: line!.id }).returning()
    )
  );

  // Emit real-time events so POS terminal + kitchen display update immediately
  io.emit("order:new", {
    ...order,
    tableNumber: table.tableNumber,
    tableId: table.id,
    source: "SELF_ORDER",
    ticketId: ticket!.id,
    linesCount: validLines.length,
  });

  io.emit("kitchen:ticket:new", {
    id: ticket!.id,
    orderId: order!.id,
    status: "TO_COOK",
    tableId: table.id,
    tableNumber: table.tableNumber,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ ...order, lines: validLines, ticketId: ticket!.id });
});

// Customer confirms payment from their phone — handles both full and split payments
router.post("/self-order/:token/pay", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const { method = "UPI" } = req.body as { method?: string };

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  // Retrieve the pending payment (has all session orderIds + split tracking)
  const pending = pendingPayments.get(token);
  if (!pending) {
    res.status(404).json({ error: "No pending payment request found. Please ask staff to re-request." });
    return;
  }

  // This part's amount — use remainingAmount for the final part to absorb rounding differences;
  // otherwise use splitAmountEach (or full amount for non-split).
  const isLastPart = pending.splitParts > 1 && pending.collectedParts === pending.splitParts - 1;
  const thisPaymentAmount = pending.splitParts > 1
    ? (isLastPart ? pending.remainingAmount : pending.splitAmountEach)
    : pending.amount;

  // Record payment entry for this part
  const { paymentsTable: pmTable } = await import("@workspace/db");
  const [payment] = await db
    .insert(pmTable)
    .values({ orderId: pending.orderId, method: method as "CASH" | "DIGITAL" | "UPI", amount: thisPaymentAmount })
    .returning();

  // Update split tracking
  const newCollectedParts = pending.collectedParts + 1;
  const newCollectedAmount = pending.collectedAmount + thisPaymentAmount;
  const newRemainingAmount = Math.max(0, pending.amount - newCollectedAmount);
  const isFullyPaid = newCollectedParts >= pending.splitParts || newRemainingAmount <= 0.01;

  if (isFullyPaid) {
    // Mark every session order as PAID
    await Promise.all(
      pending.orderIds.map(id => db.update(ordersTable).set({ status: "PAID" }).where(eq(ordersTable.id, id)))
    );
    // Clear pending payment
    pendingPayments.delete(token);
    // Emit final confirmed event
    io.emit("payment:confirmed", {
      orderId: pending.orderId,
      orderIds: pending.orderIds,
      amount: pending.amount,
      method,
      tableId: table.id,
      tableNumber: table.tableNumber,
      source: "CUSTOMER",
    });
    res.status(201).json({
      payment,
      finalPayment: true,
      paidOrderCount: pending.orderIds.length,
      totalAmount: pending.amount,
      splitParts: pending.splitParts,
      collectedParts: newCollectedParts,
    });
  } else {
    // Update in-memory pending payment with new collected totals
    pendingPayments.set(token, {
      ...pending,
      collectedParts: newCollectedParts,
      collectedAmount: newCollectedAmount,
      remainingAmount: newRemainingAmount,
    });
    // Emit partial payment event so POS can update its banner
    io.emit("payment:partial", {
      tableId: table.id,
      tableNumber: table.tableNumber,
      tableToken: token,
      collectedParts: newCollectedParts,
      splitParts: pending.splitParts,
      splitAmountEach: pending.splitAmountEach,
      collectedAmount: newCollectedAmount,
      remainingAmount: newRemainingAmount,
      totalAmount: pending.amount,
      method,
    });
    res.status(200).json({
      payment,
      finalPayment: false,
      collectedParts: newCollectedParts,
      splitParts: pending.splitParts,
      splitAmountEach: pending.splitAmountEach,
      collectedAmount: newCollectedAmount,
      remainingAmount: newRemainingAmount,
      totalAmount: pending.amount,
    });
  }
});

// Cashier requests payment — aggregates ALL unpaid orders from the current session
// Accepts optional splitBy: number to split the bill equally among N people
router.post("/self-order/:token/request-payment", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const { upiId, splitBy } = req.body as { upiId?: string; splitBy?: number };
  const splitParts = Math.max(1, Math.round(splitBy ?? 1));

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  // Find all DRAFT orders for this table that belong to the current session
  const sessionFilters: ReturnType<typeof eq>[] = [
    eq(ordersTable.tableId, table.id),
    eq(ordersTable.status, "DRAFT"),
  ];
  if (table.sessionStartedAt) {
    sessionFilters.push(gte(ordersTable.createdAt, table.sessionStartedAt));
  }

  const sessionOrders = await db
    .select()
    .from(ordersTable)
    .where(and(...sessionFilters));

  if (!sessionOrders.length) {
    res.status(400).json({ error: "No billable orders found for this session" });
    return;
  }

  // Compute aggregate total from all order lines
  const orderLinesAll = await Promise.all(
    sessionOrders.map(o => db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, o.id)))
  );
  const totalAmount = orderLinesAll.flat().reduce((sum, l) => sum + (l.total ?? 0), 0);
  const orderIds = sessionOrders.map(o => o.id);
  const primaryOrderId = orderIds[0];
  const splitAmountEach = parseFloat((totalAmount / splitParts).toFixed(2));

  let resolvedUpiId: string | null =
    typeof upiId === "string" && upiId.trim() ? upiId.trim() : null;
  if (!resolvedUpiId) {
    const [upiRow] = await db
      .select()
      .from(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.name, "UPI"), eq(paymentMethodsTable.enabled, true)))
      .limit(1);
    resolvedUpiId = upiRow?.upiId?.trim() || null;
  }

  // Persist in-memory so polling customer page can pick it up
  cleanExpiredPayments();
  pendingPayments.set(token, {
    orderId: primaryOrderId,
    orderIds,
    amount: totalAmount,
    upiId: resolvedUpiId,
    tableId: table.id,
    tableNumber: table.tableNumber,
    requestedAt: Date.now(),
    splitParts,
    splitAmountEach,
    collectedParts: 0,
    collectedAmount: 0,
    remainingAmount: totalAmount,
  });

  io.emit("payment:requested", {
    tableId: table.id,
    tableToken: token,
    tableNumber: table.tableNumber,
    orderId: primaryOrderId,
    amount: totalAmount,
    upiId: resolvedUpiId,
    splitParts,
    splitAmountEach,
    collectedParts: 0,
    remainingAmount: totalAmount,
  });

  res.json({ ok: true, amount: totalAmount, orderCount: orderIds.length, splitParts, splitAmountEach });
});

// Re-emits payment:requested with current pending split state so the next customer's device is immediately notified
router.post("/self-order/:token/nudge-payment", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) { res.status(404).json({ error: "Table not found" }); return; }

  const pending = pendingPayments.get(token);
  if (!pending) { res.status(404).json({ error: "No pending payment" }); return; }

  io.emit("payment:requested", {
    tableId: table.id,
    tableToken: token,
    tableNumber: table.tableNumber,
    orderId: pending.orderId,
    amount: pending.amount,
    upiId: pending.upiId,
    splitParts: pending.splitParts,
    splitAmountEach: pending.splitAmountEach,
    collectedParts: pending.collectedParts,
    remainingAmount: pending.remainingAmount,
  });

  res.json({ ok: true, collectedParts: pending.collectedParts, splitParts: pending.splitParts });
});

// Book a table — sets sessionStartedAt so POS knows it's occupied
router.post("/self-order/:token/book-table", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [table] = await db
    .select()
    .from(tablesTable)
    .where(eq(tablesTable.token, token))
    .limit(1);

  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  if (table.sessionStartedAt) {
    res.json({ ok: true, alreadyBooked: true, tableId: table.id, tableNumber: table.tableNumber });
    return;
  }

  const [updated] = await db
    .update(tablesTable)
    .set({ sessionStartedAt: new Date() })
    .where(eq(tablesTable.id, table.id))
    .returning();

  const [floor] = await db.select().from(floorsTable).where(eq(floorsTable.id, table.floorId)).limit(1);

  io.emit("table:booked", {
    tableId: table.id,
    tableNumber: table.tableNumber,
    floorName: floor?.name ?? "Floor",
  });

  res.json({ ok: true, alreadyBooked: false, tableId: updated.id, tableNumber: updated.tableNumber });
});

// Customer or cashier ends session — cleans up DRAFT orders, rotates token, resets session stamp
router.post("/self-order/:token/end-session", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  // Find any remaining DRAFT orders from this session and mark them CANCELLED
  // (these are orders that were never paid — e.g. customer left without paying)
  const sessionFilters: ReturnType<typeof eq>[] = [
    eq(ordersTable.tableId, table.id),
    eq(ordersTable.status, "DRAFT"),
  ];
  if (table.sessionStartedAt) {
    sessionFilters.push(gte(ordersTable.createdAt, table.sessionStartedAt));
  }
  const unpaidOrders = await db.select().from(ordersTable).where(and(...sessionFilters));
  if (unpaidOrders.length) {
    await Promise.all(
      unpaidOrders.map(o =>
        db.update(ordersTable).set({ status: "CANCELLED" }).where(eq(ordersTable.id, o.id))
      )
    );
  }

  // Rotate the table token and clear the session stamp — old QR codes become invalid
  const [updated] = await db
    .update(tablesTable)
    .set({ token: sql`gen_random_uuid()`, sessionStartedAt: null })
    .where(eq(tablesTable.token, token))
    .returning();

  // Clear any pending payment requests for old token
  pendingPayments.delete(token);

  // Broadcast so POS + customer display refresh
  io.emit("table:session:ended", { tableId: table.id, tableNumber: table.tableNumber });
  io.emit("order:paid", { tableId: table.id });

  res.json({ ok: true, newToken: updated?.token ?? null });
});

router.get("/self-order/:token/history", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [table] = await db.select().from(tablesTable).where(eq(tablesTable.token, token)).limit(1);
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  // Build filters: always scope to this table.
  // `since` (ISO timestamp) restricts to orders from the current session only.
  // `customerId` restricts to orders belonging to the identified customer.
  const sinceParam = req.query.since as string | undefined;
  const customerIdParam = req.query.customerId as string | undefined;

  const filters: ReturnType<typeof eq>[] = [eq(ordersTable.tableId, table.id)];
  if (sinceParam) {
    const sinceDate = new Date(sinceParam);
    if (!isNaN(sinceDate.getTime())) {
      filters.push(gte(ordersTable.createdAt, sinceDate));
    }
  }
  if (customerIdParam) {
    filters.push(eq(ordersTable.customerId, customerIdParam));
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(...filters))
    .orderBy(ordersTable.createdAt);

  const ordersWithDetails = await Promise.all(
    orders.map(async (order) => {
      const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id));
      const linesWithProducts = await Promise.all(
        lines.map(async (line) => {
          const [product] = await db.select().from(productsTable).where(eq(productsTable.id, line.productId)).limit(1);
          let category = null;
          if (product) {
            [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1);
          }
          return { ...line, product: product ? { ...product, category, variants: [] } : null };
        })
      );

      const [ticket] = await db
        .select()
        .from(kitchenTicketsTable)
        .where(eq(kitchenTicketsTable.orderId, order.id))
        .limit(1);

      const total = linesWithProducts.reduce((sum, line) => sum + (line?.total ?? 0), 0);

      return { ...order, lines: linesWithProducts, ticket: ticket ?? null, total };
    })
  );

  // Include any pending payment request for this table so customer page can auto-switch to PAY_REQUEST
  cleanExpiredPayments();
  const rawPending = pendingPayments.get(token) ?? null;
  let pendingPayment = rawPending;
  if (rawPending && !rawPending.upiId) {
    const [upiRow] = await db
      .select()
      .from(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.name, "UPI"), eq(paymentMethodsTable.enabled, true)))
      .limit(1);
    const u = upiRow?.upiId?.trim() || null;
    if (u) pendingPayment = { ...rawPending, upiId: u };
  }

  res.json({ orders: ordersWithDetails, pendingPayment });
});

export default router;
