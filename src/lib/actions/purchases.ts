"use server";

import { db } from "@/lib/db";
import { purchases, orders, orderItems, payments, customers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { syncCustomerToGoCreate } from "@/lib/actions/customers";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Auth helper ────────────────────────────────────────────────────────────
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

// ─── Brojevi preko sekvenci (atomarno, bez race condition-a) ─────────────────
async function nextPurchaseNumber(): Promise<string> {
  const rows = (await db.execute(sql`SELECT nextval('purchase_number_seq')::int AS seq`)) as unknown as { seq: number }[];
  return `POR-${new Date().getFullYear()}-${String(rows[0].seq).padStart(4, "0")}`;
}
async function nextNalogNumber(): Promise<string> {
  const rows = (await db.execute(sql`SELECT nextval('nalog_number_seq')::int AS seq`)) as unknown as { seq: number }[];
  return `NAL-${new Date().getFullYear()}-${String(rows[0].seq).padStart(4, "0")}`;
}

// ─── Tipovi ulaza ────────────────────────────────────────────────────────────
type OrderKind = "domaca" | "munro" | "gotov";

interface NewItem {
  artikal: string;
  quantity?: number;
  unitPrice?: number;
  material?: string;
  templateNumber?: string;
  collarType?: string;
  cuffType?: string;
  fitType?: string;
  measurementSnapshot?: Record<string, unknown>;
  monogramData?: Record<string, unknown>;
}

interface NewNalog {
  orderKind: OrderKind;
  dueDate?: string;
  notes?: string;
  items: NewItem[];
}

interface NewPurchase {
  customerId: string;
  avansAmount?: number;
  paymentMethod?: "cash" | "card" | "transfer";
  notes?: string;
  nalozi: NewNalog[];
}

// ─── createPurchase ───────────────────────────────────────────────────────────
// Kreira porudžbinu sa više naloga, svaki nalog sa više stavki.
// Avans se evidentira na nivou porudžbine.
export async function createPurchase(data: NewPurchase) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // — Validacija (server-side, ne vjeruj klijentu) —
  if (!data.customerId) throw new Error("Klijent je obavezan.");
  if (!Array.isArray(data.nalozi) || data.nalozi.length === 0)
    throw new Error("Porudžbina mora imati bar jedan nalog.");
  for (const n of data.nalozi) {
    if (!["domaca", "munro", "gotov"].includes(n.orderKind))
      throw new Error("Nepoznat tip naloga.");
    if (!Array.isArray(n.items) || n.items.length === 0)
      throw new Error("Svaki nalog mora imati bar jednu stavku.");
    for (const it of n.items) {
      if (!it.artikal || !it.artikal.trim()) throw new Error("Svaka stavka mora imati artikal.");
      if (it.quantity != null && (!Number.isFinite(it.quantity) || it.quantity < 1))
        throw new Error("Količina mora biti broj ≥ 1.");
      if (it.unitPrice != null && (!Number.isFinite(it.unitPrice) || it.unitPrice < 0))
        throw new Error("Cena mora biti broj ≥ 0.");
    }
  }

  // Provjeri da klijent pripada firmi (sprječava cross-tenant)
  const customer = await db.query.customers.findFirst({
    where: (c, { eq, and, isNull }) =>
      and(eq(c.id, data.customerId), eq(c.companyId, companyId), isNull(c.deletedAt)),
  });
  if (!customer) throw new Error("Klijent nije pronađen.");

  // — Izračun ukupne sume —
  const purchaseTotal = data.nalozi.reduce(
    (sum, n) => sum + n.items.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.quantity ?? 1), 0),
    0
  );
  const avans = data.avansAmount ?? 0;
  const paymentStatus = avans >= purchaseTotal && purchaseTotal > 0 ? "paid" : avans > 0 ? "avans" : "unpaid";

  // — Porudžbina —
  const purchaseNumber = await nextPurchaseNumber();
  const [purchase] = await db.insert(purchases).values({
    companyId,
    purchaseNumber,
    customerId: data.customerId,
    createdBy: user.id,
    totalAmount: String(purchaseTotal),
    avansAmount: String(avans),
    paidAmount: String(avans),
    paymentStatus,
    status: "open",
    notes: data.notes || null,
  }).returning();

  // — Nalozi + stavke —
  let hasMunro = false;
  for (const n of data.nalozi) {
    if (n.orderKind === "munro") hasMunro = true;
    const nalogTotal = n.items.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.quantity ?? 1), 0);
    const orderNumber = await nextNalogNumber();

    const [order] = await db.insert(orders).values({
      companyId,
      orderNumber,
      customerId: data.customerId,
      purchaseId: purchase.id,
      orderKind: n.orderKind,
      nalogStatus: "naruceno",
      productionFlow: n.orderKind === "munro" ? "munro" : "millimeter",
      dueDate: n.dueDate || null,
      totalAmount: String(nalogTotal),
      notes: n.notes || null,
      createdBy: user.id,
    }).returning();

    const itemsToInsert = n.items.map((it) => ({
      orderId: order.id,
      artikal: it.artikal.trim(),
      quantity: it.quantity ?? 1,
      unitPrice: String(it.unitPrice ?? 0),
      totalPrice: String((it.unitPrice ?? 0) * (it.quantity ?? 1)),
      material: it.material || null,
      templateNumber: it.templateNumber || null,
      collarType: it.collarType || null,
      cuffType: it.cuffType || null,
      fitType: it.fitType || null,
      measurementSnapshot: it.measurementSnapshot ?? null,
      monogramData: it.monogramData ?? null,
    }));
    await db.insert(orderItems).values(itemsToInsert);
  }

  // — Avans kao uplata —
  if (avans > 0) {
    await db.insert(payments).values({
      companyId,
      referenceType: "purchase",
      referenceId: purchase.id,
      customerId: data.customerId,
      amount: String(avans),
      paymentMethod: data.paymentMethod ?? "cash",
      paymentDate: new Date().toISOString().split("T")[0],
      notes: "Avans pri naručivanju",
      createdBy: user.id,
    });
  }

  // — Munro sync (best effort, ne blokira) —
  if (hasMunro) {
    try {
      await syncCustomerToGoCreate(data.customerId);
    } catch (err) {
      console.error("[Purchase] GoCreate sync failed:", err);
    }
  }

  revalidatePath("/orders");
  revalidatePath(`/customers/${data.customerId}`);
  return purchase;
}

// ─── getPurchases — lista porudžbina sa klijentom i nalozima ──────────────────
export async function getPurchases() {
  const { dbUser } = await getCurrentUser();
  return db.query.purchases.findMany({
    where: (p, { eq }) => eq(p.companyId, dbUser.companyId!),
    with: {
      customer: true,
      orders: { with: { items: true } },
    },
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
}

// ─── getPurchase — detalj sa nalozima i stavkama ──────────────────────────────
export async function getPurchase(id: string) {
  const { dbUser } = await getCurrentUser();
  return db.query.purchases.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, id), eq(p.companyId, dbUser.companyId!)),
    with: {
      customer: true,
      orders: { with: { items: true }, orderBy: (o, { asc }) => [asc(o.createdAt)] },
    },
  });
}

// ─── updateNalogStatus — pomjeri nalog kroz tok ───────────────────────────────
export async function updateNalogStatus(
  nalogId: string,
  status:
    | "naruceno" | "ceka_materijal" | "za_izradu" | "izrada"
    | "gotovo" | "u_radnji" | "preuzeto" | "korekcija" | "otkazano"
) {
  const { dbUser } = await getCurrentUser();
  await db.update(orders)
    .set({ nalogStatus: status, updatedAt: new Date() })
    .where(and(eq(orders.id, nalogId), eq(orders.companyId, dbUser.companyId!)));
  revalidatePath("/orders");
  revalidatePath("/production");
}

// ─── addPurchasePayment — doplata na porudžbinu ───────────────────────────────
export async function addPurchasePayment(
  purchaseId: string,
  amount: number,
  method: "cash" | "card" | "transfer" = "cash"
) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Iznos mora biti broj > 0.");

  const purchase = await db.query.purchases.findFirst({
    where: (p, { eq, and }) => and(eq(p.id, purchaseId), eq(p.companyId, companyId)),
  });
  if (!purchase) throw new Error("Porudžbina nije pronađena.");

  await db.insert(payments).values({
    companyId,
    referenceType: "purchase",
    referenceId: purchaseId,
    customerId: purchase.customerId,
    amount: String(amount),
    paymentMethod: method,
    paymentDate: new Date().toISOString().split("T")[0],
    createdBy: user.id,
  });

  const newPaid = Number(purchase.paidAmount) + amount;
  const total = Number(purchase.totalAmount);
  const paymentStatus = newPaid >= total && total > 0 ? "paid" : newPaid > 0 ? "avans" : "unpaid";

  await db.update(purchases)
    .set({ paidAmount: String(newPaid), paymentStatus, updatedAt: new Date() })
    .where(eq(purchases.id, purchaseId));

  revalidatePath("/orders");
}
