import { Router, type IRouter } from "express";
import { db, posConfigTable, floorsTable, tablesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

async function getPosConfigWithDetails(id: string) {
  const [config] = await db.select().from(posConfigTable).where(eq(posConfigTable.id, id)).limit(1);
  if (!config) return null;

  const floors = await db.select().from(floorsTable).where(eq(floorsTable.posId, id));
  const floorsWithTables = await Promise.all(
    floors.map(async (floor) => {
      const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, floor.id));
      return { ...floor, tables };
    })
  );

  return {
    ...config,
    allowedPaymentMethods: JSON.parse(config.allowedPaymentMethods || '["CASH","DIGITAL","UPI"]') as string[],
    allowedCashierIds: JSON.parse(config.allowedCashierIds || '[]') as string[],
    allowedWaiterIds: JSON.parse(config.allowedWaiterIds || '[]') as string[],
    floors: floorsWithTables,
  };
}

router.get("/pos-config", verifyToken, async (_req, res): Promise<void> => {
  const configs = await db.select().from(posConfigTable).orderBy(posConfigTable.name);

  const configsWithDetails = await Promise.all(
    configs.map(async (config) => {
      const floors = await db.select().from(floorsTable).where(eq(floorsTable.posId, config.id));
      const floorsWithTables = await Promise.all(
        floors.map(async (floor) => {
          const tables = await db.select().from(tablesTable).where(eq(tablesTable.floorId, floor.id));
          return { ...floor, tables };
        })
      );
      return {
        ...config,
        allowedPaymentMethods: JSON.parse(config.allowedPaymentMethods || '["CASH","DIGITAL","UPI"]') as string[],
        allowedCashierIds: JSON.parse(config.allowedCashierIds || '[]') as string[],
        allowedWaiterIds: JSON.parse(config.allowedWaiterIds || '[]') as string[],
        floors: floorsWithTables,
      };
    })
  );

  res.json(configsWithDetails);
});

router.post("/pos-config", verifyToken, async (req, res): Promise<void> => {
  const { name, allowedPaymentMethods, allowedCashierIds, allowedWaiterIds } = req.body as {
    name: string;
    allowedPaymentMethods?: string[];
    allowedCashierIds?: string[];
    allowedWaiterIds?: string[];
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [config] = await db.insert(posConfigTable).values({
    name,
    allowedPaymentMethods: JSON.stringify(allowedPaymentMethods ?? ["CASH", "DIGITAL", "UPI"]),
    allowedCashierIds: JSON.stringify(allowedCashierIds ?? []),
    allowedWaiterIds: JSON.stringify(allowedWaiterIds ?? []),
  }).returning();

  res.status(201).json({
    ...config,
    allowedPaymentMethods: JSON.parse(config.allowedPaymentMethods),
    allowedCashierIds: JSON.parse(config.allowedCashierIds),
    allowedWaiterIds: JSON.parse(config.allowedWaiterIds),
    floors: [],
  });
});

router.patch("/pos-config/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, allowedPaymentMethods, allowedCashierIds, allowedWaiterIds } = req.body as {
    name?: string;
    allowedPaymentMethods?: string[];
    allowedCashierIds?: string[];
    allowedWaiterIds?: string[];
  };

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (allowedPaymentMethods !== undefined) updateData.allowedPaymentMethods = JSON.stringify(allowedPaymentMethods);
  if (allowedCashierIds !== undefined) updateData.allowedCashierIds = JSON.stringify(allowedCashierIds);
  if (allowedWaiterIds !== undefined) updateData.allowedWaiterIds = JSON.stringify(allowedWaiterIds);

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [updated] = await db.update(posConfigTable).set(updateData).where(eq(posConfigTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const result = await getPosConfigWithDetails(id);
  res.json(result);
});

router.delete("/pos-config/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(posConfigTable).where(eq(posConfigTable.id, id));
  res.sendStatus(204);
});

router.get("/users", verifyToken, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
  }).from(usersTable).orderBy(usersTable.name);
  res.json(users);
});

export default router;
