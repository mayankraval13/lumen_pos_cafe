import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, posConfigTable, floorsTable, tablesTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { verifyToken, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function requireAdmin(req: AuthRequest, res: any, next: any): void {
  if (req.userRole !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

async function getWaiterAllocations(waiterId: string): Promise<{ id: string; name: string }[]> {
  const configs = await db.select().from(posConfigTable);
  return configs
    .filter((c) => {
      const ids: string[] = JSON.parse(c.allowedWaiterIds || "[]");
      return ids.includes(waiterId);
    })
    .map((c) => ({ id: c.id, name: c.name }));
}

async function enrichTable(tableRow: typeof tablesTable.$inferSelect) {
  const [floor] = await db.select().from(floorsTable).where(eq(floorsTable.id, tableRow.floorId)).limit(1);
  if (!floor) return null;

  const [posConfig] = await db.select().from(posConfigTable).where(eq(posConfigTable.id, floor.posId)).limit(1);

  const [activeOrder] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.tableId, tableRow.id), eq(ordersTable.status, "DRAFT")))
    .limit(1);

  return {
    id: tableRow.id,
    tableNumber: tableRow.tableNumber,
    seats: tableRow.seats,
    floorId: floor.id,
    floorName: floor.name,
    posConfigId: posConfig?.id ?? null,
    posConfigName: posConfig?.name ?? null,
    activeOrderId: activeOrder?.id ?? null,
    status: activeOrder ? "OCCUPIED" : "FREE",
  };
}

router.get("/waiters", verifyToken, requireAdmin, async (_req, res): Promise<void> => {
  const waiters = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, assignedTableIds: usersTable.assignedTableIds, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.role, "WAITER"))
    .orderBy(usersTable.name);

  const waitersWithDetails = await Promise.all(
    waiters.map(async (w) => {
      const tableIds: string[] = JSON.parse(w.assignedTableIds || "[]");
      const tableRows = tableIds.length > 0
        ? await Promise.all(tableIds.map(async (tid) => {
            const [t] = await db.select().from(tablesTable).where(eq(tablesTable.id, tid)).limit(1);
            return t ?? null;
          }))
        : [];
      const assignedTables = (await Promise.all(
        tableRows.filter(Boolean).map((t) => enrichTable(t!))
      )).filter(Boolean);

      return {
        ...w,
        assignedTableIds: tableIds,
        assignedTables,
        allocatedPosConfigs: await getWaiterAllocations(w.id),
      };
    })
  );

  res.json(waitersWithDetails);
});

router.get("/waiters/me", verifyToken, async (req: AuthRequest, res): Promise<void> => {
  if (req.userRole !== "WAITER") {
    res.status(403).json({ error: "Waiter access required" });
    return;
  }

  const [waiter] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, assignedTableIds: usersTable.assignedTableIds })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!waiter) {
    res.status(404).json({ error: "Waiter not found" });
    return;
  }

  const tableIds: string[] = JSON.parse(waiter.assignedTableIds || "[]");
  const tableRows = tableIds.length > 0
    ? await Promise.all(tableIds.map(async (tid) => {
        const [t] = await db.select().from(tablesTable).where(eq(tablesTable.id, tid)).limit(1);
        return t ?? null;
      }))
    : [];

  const assignedTables = (await Promise.all(
    tableRows.filter(Boolean).map((t) => enrichTable(t!))
  )).filter(Boolean);

  const posConfigId = assignedTables.length > 0 ? assignedTables[0]?.posConfigId ?? null : null;
  const posConfigName = assignedTables.length > 0 ? assignedTables[0]?.posConfigName ?? null : null;

  res.json({ ...waiter, assignedTableIds: tableIds, assignedTables, posConfigId, posConfigName });
});

router.post("/waiters", verifyToken, requireAdmin, async (req, res): Promise<void> => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, password: hashed, role: "WAITER", assignedTableIds: '[]' })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, assignedTableIds: usersTable.assignedTableIds, createdAt: usersTable.createdAt });

  if (!user) {
    res.status(500).json({ error: "Failed to create waiter" });
    return;
  }

  res.status(201).json({ ...user, assignedTableIds: [], assignedTables: [], allocatedPosConfigs: [] });
});

router.patch("/waiters/:id", verifyToken, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, email } = req.body as { name?: string; email?: string };

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (email) updates.email = email;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "WAITER")))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, assignedTableIds: usersTable.assignedTableIds, createdAt: usersTable.createdAt });

  if (!updated) {
    res.status(404).json({ error: "Waiter not found" });
    return;
  }

  res.json({ ...updated, assignedTableIds: JSON.parse(updated.assignedTableIds || '[]'), allocatedPosConfigs: await getWaiterAllocations(updated.id) });
});

router.delete("/waiters/:id", verifyToken, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [deleted] = await db
    .delete(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "WAITER")))
    .returning({ id: usersTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Waiter not found" });
    return;
  }

  const allConfigs = await db.select().from(posConfigTable);
  await Promise.all(
    allConfigs.map(async (config) => {
      const ids: string[] = JSON.parse(config.allowedWaiterIds || "[]");
      if (ids.includes(id)) {
        await db
          .update(posConfigTable)
          .set({ allowedWaiterIds: JSON.stringify(ids.filter((i) => i !== id)) })
          .where(eq(posConfigTable.id, config.id));
      }
    })
  );

  res.status(204).send();
});

router.put("/waiters/:id/allocations", verifyToken, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { posConfigIds } = req.body as { posConfigIds: string[] };

  if (!Array.isArray(posConfigIds)) {
    res.status(400).json({ error: "posConfigIds must be an array" });
    return;
  }

  const [waiter] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "WAITER")))
    .limit(1);

  if (!waiter) {
    res.status(404).json({ error: "Waiter not found" });
    return;
  }

  const allConfigs = await db.select().from(posConfigTable);
  await Promise.all(
    allConfigs.map(async (config) => {
      const currentIds: string[] = JSON.parse(config.allowedWaiterIds || "[]");
      const shouldBeIn = posConfigIds.includes(config.id);
      const isIn = currentIds.includes(id);

      if (shouldBeIn && !isIn) {
        await db.update(posConfigTable).set({ allowedWaiterIds: JSON.stringify([...currentIds, id]) }).where(eq(posConfigTable.id, config.id));
      } else if (!shouldBeIn && isIn) {
        await db.update(posConfigTable).set({ allowedWaiterIds: JSON.stringify(currentIds.filter((i) => i !== id)) }).where(eq(posConfigTable.id, config.id));
      }
    })
  );

  res.json({ waiterId: id, posConfigIds });
});

router.put("/waiters/:id/tables", verifyToken, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { tableIds } = req.body as { tableIds: string[] };

  if (!Array.isArray(tableIds)) {
    res.status(400).json({ error: "tableIds must be an array" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ assignedTableIds: JSON.stringify(tableIds) })
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "WAITER")))
    .returning({ id: usersTable.id });

  if (!updated) {
    res.status(404).json({ error: "Waiter not found" });
    return;
  }

  res.json({ waiterId: id, tableIds });
});

export default router;
