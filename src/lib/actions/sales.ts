"use server";

import { db } from "@/lib/db";
import { sales, saleItems, payments, inventoryItems, customers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { updateLoyaltyTier } from "@/lib/actions/customers";

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  const dbUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user.id),
  });
  if (!dbUser?.companyId) throw new Error("Nemaš kompaniju");
  return { user, dbUser };
}

async function generateSaleNumber(companyId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sales)
    .where(eq(sales.companyId, companyId));

  const count = Number(result[0].count) + 1;
  const year = new Date().getFullYear();
  return `RAC-${year}-${String(count).padStart(4, "0")}`;
}

export async function getSales() {
  const { dbUser } = await getCurrentUser();

  return db.query.sales.findMany({
    where: (s, { eq }) => eq(s.companyId, dbUser.companyId!),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    with: {
      customer: true,
      items: true,
    },
  });
}

export async function createSale(data: {
  customerId?: string;
  paymentMethod: "cash" | "card" | "transfer";
  items: Array<{
    itemName: string;
    inventoryItemId?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  notes?: string;
}) {
  const { user, dbUser } = await getCurrentUser();

  const totalAmount = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const saleNumber = await generateSaleNumber(dbUser.companyId!);

  const [sale] = await db
    .insert(sales)
    .values({
      companyId: dbUser.companyId!,
      saleNumber,
      customerId: data.customerId || null,
      createdBy: user.id,
      paymentMethod: data.paymentMethod,
      status: "completed",
      totalAmount: String(totalAmount),
      notes: data.notes || null,
    })
    .returning();

  await db.insert(saleItems).values(
    data.items.map((item) => ({
      saleId: sale.id,
      itemName: item.itemName,
      inventoryItemId: item.inventoryItemId || null,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.totalPrice),
    }))
  );

  // Smanji stanje gotove robe
  for (const item of data.items) {
    if (item.inventoryItemId) {
      await db
        .update(inventoryItems)
        .set({ quantity: sql`quantity - ${item.quantity}` })
        .where(eq(inventoryItems.id, item.inventoryItemId));
    }
  }

  // Evidentiraj uplatu
  await db.insert(payments).values({
    companyId: dbUser.companyId!,
    referenceType: "sale",
    referenceId: sale.id,
    customerId: data.customerId || null,
    amount: String(totalAmount),
    paymentMethod: data.paymentMethod,
    paymentDate: new Date().toISOString().split("T")[0],
    createdBy: user.id,
  });

  // Ažuriraj klijenta ako je vezan za prodaju
  if (data.customerId) {
    await db
      .update(customers)
      .set({
        totalSpent: sql`total_spent + ${totalAmount}`,
        visitCount: sql`visit_count + 1`,
        lastVisitDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(eq(customers.id, data.customerId));

    const updatedCustomer = await db.query.customers.findFirst({
      where: (c, { eq }) => eq(c.id, data.customerId!),
    });
    if (updatedCustomer) {
      await updateLoyaltyTier(data.customerId, Number(updatedCustomer.totalSpent));
    }
  }

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/customers");
  return sale;
}
