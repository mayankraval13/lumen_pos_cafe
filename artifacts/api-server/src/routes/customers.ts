import { Router, type IRouter } from "express";
import { db, customersTable, ordersTable, paymentsTable, orderLinesTable, productsTable } from "@workspace/db";
import { eq, ilike, sql, desc } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/customers", verifyToken, async (req, res): Promise<void> => {
  const { search } = req.query as { search?: string };

  const customers = await db.select().from(customersTable).orderBy(customersTable.name);

  const q = search?.trim().toLowerCase() ?? "";
  const customersWithStats = await Promise.all(
    customers
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q) ?? false) ||
          (c.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ?? false),
      )
      .map(async (customer) => {
        const [result] = await db
          .select({ total: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::float` })
          .from(paymentsTable)
          .innerJoin(ordersTable, eq(ordersTable.id, paymentsTable.orderId))
          .where(eq(ordersTable.customerId, customer.id));

        return { ...customer, totalSales: result?.total ?? 0 };
      })
  );

  res.json(customersWithStats);
});

router.post("/customers", verifyToken, async (req, res): Promise<void> => {
  const { name, email, phone, address, city, state, country = "India" } = req.body as {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [customer] = await db
    .insert(customersTable)
    .values({ name, email, phone, address, city, state, country })
    .returning();

  res.status(201).json(customer);
});

router.put("/customers/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, email, phone, address, city, state, country } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };

  const updateData: Record<string, unknown> = {};
  if (name != null) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (country != null) updateData.country = country;

  const [updated] = await db
    .update(customersTable)
    .set(updateData)
    .where(eq(customersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(updated);
});

router.delete("/customers/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.sendStatus(204);
});

router.get("/customers/:id/orders", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.customerId, id))
    .orderBy(desc(ordersTable.createdAt));

  const ordersWithLines = await Promise.all(
    orders.map(async (order) => {
      const lines = await db
        .select()
        .from(orderLinesTable)
        .where(eq(orderLinesTable.orderId, order.id));
      const linesWithProducts = await Promise.all(
        lines.map(async (line) => {
          const [product] = await db.select().from(productsTable).where(eq(productsTable.id, line.productId)).limit(1);
          return { ...line, productName: product?.name ?? 'Unknown' };
        })
      );
      return { ...order, lines: linesWithProducts };
    })
  );

  res.json(ordersWithLines);
});

export default router;
