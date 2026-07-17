"use server";

import { db } from "@/lib/db";
import { sales, saleItems, payments, inventoryItems, customers } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { calcLoyaltyTier } from "@/lib/loyalty";
import { requireActiveUser } from "@/lib/auth";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
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
  }>;
  notes?: string;
}) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // — Validacija: server računa novac, klijentu se ne vjeruje —
  if (!["cash", "card", "transfer"].includes(data.paymentMethod))
    throw new Error("Nepoznat način plaćanja.");
  if (!Array.isArray(data.items) || data.items.length === 0)
    throw new Error("Prodaja mora imati bar jednu stavku.");
  for (const it of data.items) {
    if (!it.itemName || !it.itemName.trim()) throw new Error("Svaka stavka mora imati naziv.");
    if (!Number.isInteger(it.quantity) || it.quantity < 1) throw new Error("Količina mora biti cio broj ≥ 1.");
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new Error("Cena mora biti broj ≥ 0.");
  }

  // Klijent (ako je naveden) mora pripadati firmi
  if (data.customerId) {
    const cust = await db.query.customers.findFirst({
      where: (c, { eq, and, isNull }) =>
        and(eq(c.id, data.customerId!), eq(c.companyId, companyId), isNull(c.deletedAt)),
    });
    if (!cust) throw new Error("Klijent nije pronađen.");
  }

  // Artikli (ako su iz zaliha) moraju pripadati firmi
  for (const it of data.items) {
    if (it.inventoryItemId) {
      const inv = await db.query.inventoryItems.findFirst({
        where: (i, { eq, and }) => and(eq(i.id, it.inventoryItemId!), eq(i.companyId, companyId)),
      });
      if (!inv) throw new Error(`Artikal "${it.itemName}" nije pronađen u zalihama.`);
    }
  }

  // totalPrice se računa OVDJE, ne prima od klijenta
  const totalAmount = data.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const saleNumber = await generateSaleNumber(companyId);

  // Sve u jednoj transakciji — nema prodaje bez stavki/uplate
  const sale = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(sales)
      .values({
        companyId,
        saleNumber,
        customerId: data.customerId || null,
        createdBy: user.id,
        paymentMethod: data.paymentMethod,
        status: "completed",
        totalAmount: String(totalAmount),
        notes: data.notes || null,
      })
      .returning();

    await tx.insert(saleItems).values(
      data.items.map((item) => ({
        saleId: s.id,
        itemName: item.itemName.trim(),
        inventoryItemId: item.inventoryItemId || null,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        totalPrice: String(item.unitPrice * item.quantity),
      }))
    );

    // Smanji stanje gotove robe (scoped po firmi)
    for (const item of data.items) {
      if (item.inventoryItemId) {
        await tx
          .update(inventoryItems)
          .set({ quantity: sql`quantity - ${item.quantity}` })
          .where(and(eq(inventoryItems.id, item.inventoryItemId), eq(inventoryItems.companyId, companyId)));
      }
    }

    // Evidentiraj uplatu
    await tx.insert(payments).values({
      companyId,
      referenceType: "sale",
      referenceId: s.id,
      customerId: data.customerId || null,
      amount: String(totalAmount),
      paymentMethod: data.paymentMethod,
      paymentDate: new Date().toISOString().split("T")[0],
      createdBy: user.id,
    });

    // Ažuriraj klijenta ako je vezan za prodaju
    if (data.customerId) {
      const [updatedCustomer] = await tx
        .update(customers)
        .set({
          totalSpent: sql`total_spent + ${totalAmount}`,
          visitCount: sql`visit_count + 1`,
          lastVisitDate: new Date().toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(and(eq(customers.id, data.customerId), eq(customers.companyId, companyId)))
        .returning({ totalSpent: customers.totalSpent });

      if (updatedCustomer) {
        await tx
          .update(customers)
          .set({ loyaltyTier: calcLoyaltyTier(Number(updatedCustomer.totalSpent)) })
          .where(and(eq(customers.id, data.customerId), eq(customers.companyId, companyId)));
      }
    }

    return s;
  });

  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/customers");
  return sale;
}
