import { Router, type IRouter } from "express";
import { db, productsTable, productVariantsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router: IRouter = Router();

async function getProductWithDetails(id: string) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) return null;

  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId)).limit(1);
  const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, id));

  return { ...product, category: category ?? null, variants };
}

router.get("/products", verifyToken, async (req, res): Promise<void> => {
  const { categoryId, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 50;
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const products = await db
    .select()
    .from(productsTable)
    .where(whereClause)
    .orderBy(productsTable.name)
    .limit(limitNum)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(whereClause);

  const total = countResult?.count ?? 0;

  const productsWithDetails = await Promise.all(
    products.map(async (p) => {
      const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
      const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, p.id));
      return { ...p, category: category ?? null, variants };
    })
  );

  res.json({ products: productsWithDetails, total, page: pageNum, limit: limitNum });
});

router.post("/products", verifyToken, async (req, res): Promise<void> => {
  const { name, categoryId, price, unit = "Unit", tax = 5, description, imageUrl } = req.body as {
    name: string;
    categoryId: string;
    price: number;
    unit?: string;
    tax?: number;
    description?: string;
    imageUrl?: string;
  };

  if (!name || !categoryId || price == null) {
    res.status(400).json({ error: "name, categoryId, and price are required" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({ name, categoryId, price, unit, tax, description, imageUrl })
    .returning();

  const full = await getProductWithDetails(product!.id);
  res.status(201).json(full);
});

router.get("/products/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const product = await getProductWithDetails(id);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(product);
});

router.patch("/products/:id/availability", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { isAvailable } = req.body as { isAvailable: boolean };

  if (typeof isAvailable !== "boolean") {
    res.status(400).json({ error: "isAvailable must be a boolean" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({ isAvailable })
    .where(eq(productsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const full = await getProductWithDetails(id);
  res.json(full);
});

router.put("/products/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, categoryId, price, unit, tax, description, imageUrl, isAvailable } = req.body as {
    name?: string;
    categoryId?: string;
    price?: number;
    unit?: string;
    tax?: number;
    description?: string;
    imageUrl?: string;
    isAvailable?: boolean;
  };

  const updateData: Record<string, unknown> = {};
  if (name != null) updateData.name = name;
  if (categoryId != null) updateData.categoryId = categoryId;
  if (price != null) updateData.price = price;
  if (unit != null) updateData.unit = unit;
  if (tax != null) updateData.tax = tax;
  if (description !== undefined) updateData.description = description;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

  const [updated] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const full = await getProductWithDetails(id);
  res.json(full);
});

router.delete("/products/:id", verifyToken, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

router.post("/products/:id/variants", verifyToken, async (req, res): Promise<void> => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { attribute, value, extraPrice = 0, unit = "Unit" } = req.body as {
    attribute: string;
    value: string;
    extraPrice?: number;
    unit?: string;
  };

  if (!attribute || !value) {
    res.status(400).json({ error: "attribute and value are required" });
    return;
  }

  const [variant] = await db
    .insert(productVariantsTable)
    .values({ productId, attribute, value, extraPrice, unit })
    .returning();

  res.status(201).json(variant);
});

router.delete("/products/variants/:variantId", verifyToken, async (req, res): Promise<void> => {
  const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : req.params.variantId;
  await db.delete(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  res.sendStatus(204);
});

export default router;
