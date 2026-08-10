"use server";

import { db } from "@/lib/db";
import { orders, corrections, payments, customers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { belgradeToday } from "@/lib/datetime";
import { calcLoyaltyTier } from "@/lib/loyalty";
import { requireActiveUser } from "@/lib/auth";
import { withTxRetry } from "@/lib/db-retry";

// ─── Nalog za GOTOV PROIZVOD (v1 — Aleksandrov "prost nalog") ─────────────────
// Ime/prezime/broj (izbor klijenta) + odabir artikla iz kataloga + opciona korekcija.
// Kupi-i-nosi je norma (naplaćeno odmah); ako ide na korekciju, obično se plaća kasnije,
// pa je `paid` odvojen prekidač. Ne dira zalihe (katalog nema stanje). NIJE "naruceno"
// tok — gotov proizvod je odmah preuzet ili ide na korekciju.
export async function createFinishedGoodsOrder(data: {
  customerId: string;
  articleName: string;
  price: number;
  paymentMethod: "cash" | "card" | "transfer";
  paid?: boolean;
  needsCorrection?: boolean;
  correctionNote?: string;
  inventoryItemId?: string;
}) {
  const { user, dbUser } = await requireActiveUser();
  const companyId = dbUser.companyId!;

  if (!data.articleName?.trim()) throw new Error("Artikal je obavezan.");
  if (!Number.isFinite(data.price) || data.price < 0) throw new Error("Cena mora biti broj ≥ 0.");
  if (!["cash", "card", "transfer"].includes(data.paymentMethod)) throw new Error("Nepoznat način plaćanja.");

  const paid = data.paid !== false; // podrazumijevano naplaćeno
  const needsCorrection = !!data.needsCorrection;
  const today = belgradeToday();

  await withTxRetry(() => db.transaction(async (tx) => {
    // Klijent mora pripadati firmi i ne smije biti obrisan (zaključan da ga merge ne dira usput)
    const custRows = (await tx.execute(sql`
      SELECT id FROM customers WHERE id = ${data.customerId} AND company_id = ${companyId} AND deleted_at IS NULL FOR KEY SHARE
    `)) as unknown as { id: string }[];
    if (!custRows[0]) throw new Error("Klijent nije pronađen.");

    // Broj naloga GP-YYYY-NNNN (count+1; UNIQUE(company_id, order_number) je backstop)
    const cnt = (await tx.execute(sql`SELECT count(*)::int AS c FROM orders WHERE company_id = ${companyId}`)) as unknown as { c: number }[];
    const orderNumber = `GP-${new Date().getFullYear()}-${String(Number(cnt[0].c) + 1).padStart(4, "0")}`;

    const [ord] = await tx.insert(orders).values({
      companyId,
      orderNumber,
      customerId: data.customerId,
      orderType: "ready_made",
      orderKind: "gotov",
      status: needsCorrection ? "in_production" : "delivered",
      nalogStatus: needsCorrection ? "korekcija" : "preuzeto",
      createdBy: user.id,
      item: data.articleName.trim(),
      totalAmount: String(data.price),
      paidAmount: paid ? String(data.price) : "0",
      paymentStatus: paid ? "paid" : "unpaid",
      deliveredAt: needsCorrection ? null : new Date(),
      completedAt: needsCorrection ? null : new Date(),
      notes: data.inventoryItemId ? `Katalog artikal: ${data.inventoryItemId}` : null,
    }).returning({ id: orders.id });

    // Uplata + knjiženje na klijenta samo ako je naplaćeno
    if (paid && data.price > 0) {
      await tx.insert(payments).values({
        companyId,
        referenceType: "order",
        referenceId: ord.id,
        customerId: data.customerId,
        amount: String(data.price),
        paymentMethod: data.paymentMethod,
        paymentDate: today,
        createdBy: user.id,
      });
      const [c] = await tx.update(customers).set({
        totalSpent: sql`total_spent + ${data.price}`,
        visitCount: sql`visit_count + 1`,
        lastVisitDate: today,
        firstVisitDate: sql`COALESCE(first_visit_date, ${today})`,
        updatedAt: new Date(),
      }).where(and(eq(customers.id, data.customerId), eq(customers.companyId, companyId)))
        .returning({ totalSpent: customers.totalSpent });
      if (c) await tx.update(customers).set({ loyaltyTier: calcLoyaltyTier(Number(c.totalSpent)) })
        .where(and(eq(customers.id, data.customerId), eq(customers.companyId, companyId)));
    }

    // Opciona korekcija — vezana za ovaj nalog
    if (needsCorrection) {
      await tx.insert(corrections).values({
        companyId,
        orderId: ord.id,
        customerId: data.customerId,
        correctionType: "gotov proizvod",
        description: (data.correctionNote || "").trim() || "Korekcija gotovog proizvoda",
        status: "open",
        createdBy: user.id,
      });
    }
  }));

  revalidatePath("/orders");
  revalidatePath("/corrections");
  revalidatePath("/customers");
  revalidatePath("/gotov-proizvod");
}
