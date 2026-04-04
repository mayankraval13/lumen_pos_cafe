import { Router, type IRouter } from "express";
import {
  db,
  kitchenTicketsTable,
  kitchenTicketItemsTable,
  orderLinesTable,
  ordersTable,
  tablesTable,
  customersTable,
  productsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { io } from "../index";

const router: IRouter = Router();

async function getTicketWithDetails(ticketId: string) {
  const [ticket] = await db.select().from(kitchenTicketsTable).where(eq(kitchenTicketsTable.id, ticketId)).limit(1);
  if (!ticket) return null;

  const items = await db.select().from(kitchenTicketItemsTable).where(eq(kitchenTicketItemsTable.ticketId, ticketId));

  const itemsWithLines = await Promise.all(
    items.map(async (item) => {
      const [line] = await db.select().from(orderLinesTable).where(eq(orderLinesTable.id, item.orderLineId)).limit(1);
      let product = null;
      if (line) {
        const [p] = await db.select().from(productsTable).where(eq(productsTable.id, line.productId)).limit(1);
        let category = null;
        if (p) {
          [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
        }
        product = p ? { ...p, category: category ?? null, variants: [] } : null;
      }
      return { ...item, orderLine: line ? { ...line, product } : null };
    })
  );

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, ticket.orderId)).limit(1);
  const table = order?.tableId ? (await db.select().from(tablesTable).where(eq(tablesTable.id, order.tableId)).limit(1))[0] ?? null : null;
  const customer = order?.customerId ? (await db.select().from(customersTable).where(eq(customersTable.id, order.customerId)).limit(1))[0] ?? null : null;

  const lines = order ? await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id)) : [];
  const total = lines.reduce((sum, l) => sum + l.total, 0);

  return {
    ...ticket,
    items: itemsWithLines,
    order: order ? { ...order, total, table, customer } : null,
  };
}

router.get("/kitchen/tickets", async (req, res): Promise<void> => {
  const { status, search } = req.query as { status?: string; search?: string };

  let tickets = await db.select().from(kitchenTicketsTable).orderBy(kitchenTicketsTable.createdAt);

  if (status) {
    tickets = tickets.filter((t) => t.status === status);
  }

  const ticketsWithDetails = await Promise.all(
    tickets.map((t) => getTicketWithDetails(t.id))
  );

  const validTickets = ticketsWithDetails.filter((t) => t !== null);

  if (search) {
    const lowerSearch = search.toLowerCase();
    return res.json(
      validTickets.filter((t) => {
        if (!t) return false;
        if (t.orderId.toLowerCase().includes(lowerSearch)) return true;
        if (t.items.some((item) => item.orderLine?.product?.name.toLowerCase().includes(lowerSearch))) return true;
        return false;
      })
    ) as unknown as void;
  }

  res.json(validTickets);
});

router.post("/kitchen/tickets", async (req, res): Promise<void> => {
  const { orderId } = req.body as { orderId: string };

  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  // Check if ticket already exists
  const [existing] = await db
    .select()
    .from(kitchenTicketsTable)
    .where(eq(kitchenTicketsTable.orderId, orderId))
    .limit(1);

  if (existing) {
    const full = await getTicketWithDetails(existing.id);
    res.json(full);
    return;
  }

  const [ticket] = await db
    .insert(kitchenTicketsTable)
    .values({ orderId, status: "TO_COOK" })
    .returning();

  // Create items from order lines
  const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, orderId));
  await Promise.all(
    lines.map((line) =>
      db.insert(kitchenTicketItemsTable).values({ ticketId: ticket!.id, orderLineId: line.id }).returning()
    )
  );

  const full = await getTicketWithDetails(ticket!.id);
  io.emit("ticket:created", { ticket: full });

  res.status(201).json(full);
});

router.put("/kitchen/tickets/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status: "TO_COOK" | "PREPARING" | "COMPLETED" };

  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }

  const [updated] = await db
    .update(kitchenTicketsTable)
    .set({ status })
    .where(eq(kitchenTicketsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const full = await getTicketWithDetails(id);
  io.emit("ticket:updated", { ticket: full });

  // When order is ready, notify customers and POS
  if (status === "COMPLETED" && full?.order) {
    io.emit("kitchen:order:ready", {
      orderId: full.order.id,
      tableId: full.order.table?.tableNumber ? (full.order as any).tableId : null,
      tableNumber: full.order.table?.tableNumber ?? null,
    });
  }

  res.json(full);
});

router.put("/kitchen/tickets/:id/items/:itemId", async (req, res): Promise<void> => {
  const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  const { prepared } = req.body as { prepared: boolean };

  const [updated] = await db
    .update(kitchenTicketItemsTable)
    .set({ prepared })
    .where(eq(kitchenTicketItemsTable.id, itemId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Ticket item not found" });
    return;
  }

  io.emit("item:prepared", { ticketId, itemId });

  res.json(updated);
});

export default router;
