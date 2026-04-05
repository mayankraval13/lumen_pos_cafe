import { Router, type IRouter } from "express";
import { db, floorsTable, tablesTable, posConfigTable, ordersTable, orderLinesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/floors", verifyToken, async (_req, res): Promise<void> => {
  const floors = await db.select().from(floorsTable).orderBy(floorsTable.name);
  const floorsWithTables = await Promise.all(
    floors.map(async (floor) => {
      const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, floor.id));
      return { ...floor, tables };
    })
  );
  res.json(floorsWithTables);
});

router.post("/floors", verifyToken, async (req, res): Promise<void> => {
  const { name, posId } = req.body as { name: string; posId: string };

  if (!name || !posId) {
    res.status(400).json({ error: "name and posId are required" });
    return;
  }

  const [floor] = await db.insert(floorsTable).values({ name, posId }).returning();
  res.status(201).json({ ...floor, tables: [] });
});

router.put("/floors/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, posId } = req.body as { name?: string; posId?: string };

  const updateData: Record<string, unknown> = {};
  if (name != null) updateData.name = name;
  if (posId != null) updateData.posId = posId;

  const [updated] = await db
    .update(floorsTable)
    .set(updateData)
    .where(eq(floorsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Floor not found" });
    return;
  }

  const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, id));
  res.json({ ...updated, tables });
});

router.delete("/floors/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(tablesTable).where(eq(tablesTable.floorId, id));
  await db.delete(floorsTable).where(eq(floorsTable.id, id));
  res.sendStatus(204);
});

router.get("/floors/:id/tables", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, id));

  // Enrich each table with its active order info (any DRAFT order, cross-session)
  const tablesWithStatus = await Promise.all(
    tables.map(async (table) => {
      const [activeOrder] = await db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.tableId, table.id), eq(ordersTable.status, "DRAFT")))
        .orderBy(ordersTable.createdAt)
        .limit(1);

      let activeOrderTotal: number | null = null;
      if (activeOrder) {
        const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, activeOrder.id));
        activeOrderTotal = lines.reduce((sum, l) => sum + l.total, 0);
      }

      return {
        ...table,
        activeOrderId: activeOrder?.id ?? null,
        activeOrderSessionId: activeOrder?.sessionId ?? null,
        activeOrderTotal,
      };
    })
  );

  res.json(tablesWithStatus);
});

// Tables routes
router.post("/tables", verifyToken, async (req, res): Promise<void> => {
  const { floorId, tableNumber, seats = 4 } = req.body as {
    floorId: string;
    tableNumber: string;
    seats?: number;
  };

  if (!floorId || !tableNumber) {
    res.status(400).json({ error: "floorId and tableNumber are required" });
    return;
  }

  const [table] = await db.insert(tablesTable).values({ floorId, tableNumber, seats }).returning();
  res.status(201).json(table);
});

router.put("/tables/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { tableNumber, seats, active } = req.body as {
    tableNumber?: string;
    seats?: number;
    active?: boolean;
  };

  const updateData: Record<string, unknown> = {};
  if (tableNumber != null) updateData.tableNumber = tableNumber;
  if (seats != null) updateData.seats = seats;
  if (active !== undefined) updateData.active = active;

  const [updated] = await db
    .update(tablesTable)
    .set(updateData)
    .where(eq(tablesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  res.json(updated);
});

router.delete("/tables/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(tablesTable).where(eq(tablesTable.id, id));
  res.sendStatus(204);
});

router.post("/tables/:id/rotate-token", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const newToken = crypto.randomUUID();
  const [updated] = await db
    .update(tablesTable)
    .set({ token: newToken })
    .where(eq(tablesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Table not found" });
    return;
  }
  res.json(updated);
});

export default router;
