import { Router, type IRouter } from "express";
import { db, paymentMethodsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/payment-methods", verifyToken, async (_req, res): Promise<void> => {
  const methods = await db.select().from(paymentMethodsTable);
  res.json(methods);
});

router.put("/payment-methods/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { enabled, upiId } = req.body as { enabled?: boolean; upiId?: string | null };

  const updateData: Record<string, unknown> = {};
  if (enabled !== undefined) updateData.enabled = enabled;
  if (upiId !== undefined) updateData.upiId = upiId;

  const [updated] = await db
    .update(paymentMethodsTable)
    .set(updateData)
    .where(eq(paymentMethodsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Payment method not found" });
    return;
  }

  res.json(updated);
});

export default router;
