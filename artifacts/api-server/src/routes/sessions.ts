import { Router, type IRouter } from "express";
import { db, posSessionsTable, posConfigTable, usersTable, floorsTable, tablesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { verifyToken, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function getSessionWithDetails(sessionId: string) {
  const [session] = await db.select().from(posSessionsTable).where(eq(posSessionsTable.id, sessionId)).limit(1);
  if (!session) return null;

  const [pos] = await db.select().from(posConfigTable).where(eq(posConfigTable.id, session.posConfigId)).limit(1);
  const [cashier] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, session.cashierId)).limit(1);

  const floors = pos ? await db.select().from(floorsTable).where(eq(floorsTable.posId, pos.id)) : [];
  const floorsWithTables = await Promise.all(
    floors.map(async (floor) => {
      const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, floor.id));
      return { ...floor, tables };
    })
  );

  return {
    ...session,
    pos: pos ? { ...pos, floors: floorsWithTables } : null,
    cashier: cashier ?? null,
  };
}

router.get("/sessions/configs", verifyToken, async (req: AuthRequest, res): Promise<void> => {
  const configs = await db.select().from(posConfigTable).orderBy(posConfigTable.name);

  if (req.userRole === "WAITER") {
    const filtered = configs.filter((c) => {
      const ids: string[] = JSON.parse(c.allowedWaiterIds || "[]");
      return ids.length === 0 || ids.includes(req.userId!);
    });
    res.json(filtered);
    return;
  }

  res.json(configs);
});

router.get("/sessions/active", verifyToken, async (req: AuthRequest, res): Promise<void> => {
  const [session] = await db
    .select()
    .from(posSessionsTable)
    .where(and(eq(posSessionsTable.cashierId, req.userId!), eq(posSessionsTable.status, "OPEN")))
    .orderBy(posSessionsTable.openedAt)
    .limit(1);

  if (!session) {
    res.json(null);
    return;
  }

  const full = await getSessionWithDetails(session.id);
  res.json(full);
});

router.post("/sessions/open", verifyToken, async (req: AuthRequest, res): Promise<void> => {
  const { posConfigId } = req.body as { posConfigId: string };

  if (!posConfigId) {
    res.status(400).json({ error: "posConfigId is required" });
    return;
  }

  // Close any existing open sessions for this cashier
  await db
    .update(posSessionsTable)
    .set({ status: "CLOSED", closedAt: new Date() })
    .where(and(eq(posSessionsTable.cashierId, req.userId!), eq(posSessionsTable.status, "OPEN")));

  // Update lastOpenedAt on config
  await db
    .update(posConfigTable)
    .set({ lastOpenedAt: new Date() })
    .where(eq(posConfigTable.id, posConfigId));

  const [session] = await db
    .insert(posSessionsTable)
    .values({ posConfigId, cashierId: req.userId!, status: "OPEN" })
    .returning();

  res.status(201).json(session);
});

router.post("/sessions/:id/close", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [session] = await db
    .update(posSessionsTable)
    .set({ status: "CLOSED", closedAt: new Date() })
    .where(eq(posSessionsTable.id, id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});

export default router;
