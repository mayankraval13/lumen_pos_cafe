import { Router, type IRouter } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/categories", verifyToken, async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(categories);
});

router.post("/categories", verifyToken, async (req, res): Promise<void> => {
  const { name, color } = req.body as { name: string; color: string };

  if (!name || !color) {
    res.status(400).json({ error: "name and color are required" });
    return;
  }

  const [category] = await db.insert(categoriesTable).values({ name, color }).returning();
  res.status(201).json(category);
});

router.put("/categories/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, color } = req.body as { name?: string; color?: string };

  const [updated] = await db
    .update(categoriesTable)
    .set({ ...(name && { name }), ...(color && { color }) })
    .where(eq(categoriesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  res.json(updated);
});

router.delete("/categories/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

export default router;
