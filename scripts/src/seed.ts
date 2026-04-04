import {
  db,
  eq,
  usersTable,
  categoriesTable,
  productsTable,
  paymentMethodsTable,
  posConfigTable,
  floorsTable,
  tablesTable,
  customersTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Users
  const adminPassword = await bcrypt.hash("admin123", 10);
  const cashierPassword = await bcrypt.hash("cashier123", 10);

  const [admin] = await db
    .insert(usersTable)
    .values({ name: "Admin", email: "admin@pos.com", password: adminPassword, role: "ADMIN" })
    .onConflictDoNothing()
    .returning();

  const [cashier] = await db
    .insert(usersTable)
    .values({ name: "Cashier", email: "cashier@pos.com", password: cashierPassword, role: "CASHIER" })
    .onConflictDoNothing()
    .returning();

  console.log("Users seeded");

  // Categories
  const [quickBites] = await db.insert(categoriesTable).values({ name: "Quick Bites", color: "#F97316" }).onConflictDoNothing().returning();
  const [drinks] = await db.insert(categoriesTable).values({ name: "Drinks", color: "#3B82F6" }).onConflictDoNothing().returning();
  const [dessert] = await db.insert(categoriesTable).values({ name: "Dessert", color: "#EC4899" }).onConflictDoNothing().returning();
  const [food] = await db.insert(categoriesTable).values({ name: "Food", color: "#22C55E" }).onConflictDoNothing().returning();

  console.log("Categories seeded");

  // Get categories from DB if not just created (conflict)
  const allCategories = await db.select().from(categoriesTable);
  const catMap: Record<string, string> = {};
  for (const cat of allCategories) {
    catMap[cat.name] = cat.id;
  }

  // Products
  const productData = [
    { name: "Burger", price: 15, categoryName: "Food" },
    { name: "Pizza", price: 25, categoryName: "Food" },
    { name: "Coffee", price: 5, categoryName: "Drinks" },
    { name: "Sandwich", price: 10, categoryName: "Quick Bites" },
    { name: "Water", price: 3, categoryName: "Drinks" },
    { name: "Fries", price: 12, categoryName: "Quick Bites" },
    { name: "Pasta", price: 20, categoryName: "Food" },
    { name: "Green Tea", price: 6, categoryName: "Drinks" },
    { name: "Milkshake", price: 14, categoryName: "Drinks" },
    { name: "Taco", price: 60, categoryName: "Quick Bites" },
    { name: "Dirt Cake", price: 40, categoryName: "Dessert" },
  ];

  for (const p of productData) {
    const categoryId = catMap[p.categoryName];
    if (categoryId) {
      await db
        .insert(productsTable)
        .values({ name: p.name, categoryId, price: p.price, tax: 5, unit: "Unit" })
        .onConflictDoNothing();
    }
  }

  console.log("Products seeded");

  // Payment Methods
  await db
    .insert(paymentMethodsTable)
    .values([
      { name: "CASH", enabled: true },
      { name: "DIGITAL", enabled: true },
      { name: "UPI", enabled: true, upiId: "123@ybl.com" },
    ])
    .onConflictDoNothing();

  console.log("Payment methods seeded");

  // POS Config - upsert: use the first existing config, or create one
  const allConfigs = await db.select().from(posConfigTable);
  let posId: string | undefined;
  if (allConfigs.length > 0) {
    posId = allConfigs[0].id;
    // Ensure it's named "Odoo Cafe"
    await db.update(posConfigTable).set({ name: "Odoo Cafe" }).where(eq(posConfigTable.id, posId));
  } else {
    const [newConfig] = await db.insert(posConfigTable).values({ name: "Odoo Cafe" }).returning();
    posId = newConfig?.id;
  }

  if (posId) {
    // Floor - find or create one linked to this POS config
    const allFloors = await db.select().from(floorsTable);
    let floorId: string | undefined = allFloors.find((f) => f.posId === posId)?.id;
    if (!floorId) {
      // If floors exist with wrong posId, re-link the first one
      if (allFloors.length > 0) {
        await db.update(floorsTable).set({ posId }).where(eq(floorsTable.id, allFloors[0].id));
        floorId = allFloors[0].id;
      } else {
        const [newFloor] = await db
          .insert(floorsTable)
          .values({ name: "Ground Floor", posId })
          .returning();
        floorId = newFloor?.id;
      }
    }
    if (!floorId) floorId = ''; // fallback (should not happen)

    if (floorId) {
      // Tables 101-107
      for (let i = 101; i <= 107; i++) {
        await db
          .insert(tablesTable)
          .values({ floorId, tableNumber: String(i), seats: 5 })
          .onConflictDoNothing();
      }
      console.log("Tables seeded");
    }
  }

  console.log("POS Config seeded");

  // Customer
  await db
    .insert(customersTable)
    .values({
      name: "Eric Smith",
      email: "eric@odoo.com",
      phone: "+91 9898982898",
      city: "Gandhinagar",
      state: "Gujarat",
      country: "India",
    })
    .onConflictDoNothing();

  console.log("Customer seeded");
  console.log("Seeding complete!");
}

seed().catch(console.error);
