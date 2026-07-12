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
  if (!Number.isFinite(avans) || avans < 0) throw new Error("Avans mora biti broj ≥ 0.");
  if (avans > purchaseTotal) throw new Error("Avans ne može biti veći od ukupne sume porudžbine.");
  const paymentStatus = avans >= purchaseTotal && purchaseTotal > 0 ? "paid" : avans > 0 ? "avans" : "unpaid";

  // Aktivne mere klijenta — snapshot za krojački nalog (domaća/munro).
  // Bez ovoga štampani nalog za krojača nema mere.
  const activeMeasurement = await db.query.customerMeasurements.findFirst({
    where: (m, { eq, and }) => and(eq(m.customerId, data.customerId), eq(m.isActive, true)),
  });
  const measurementSnapshot = (activeMeasurement?.data as Record<string, unknown> | undefined) ?? null;

  // Brojevi iz sekvenci — pre transakcije (sekvence ionako nisu transakcione)
  const purchaseNumber = await nextPurchaseNumber();
  const nalogNumbers: string[] = [];
  for (let i = 0; i < data.nalozi.length; i++) nalogNumbers.push(await nextNalogNumber());

  // — Sve u jednoj transakciji: porudžbina + nalozi + stavke + avans —
  // Ako bilo šta pukne, ništa ne ostaje u bazi (nema porudžbine bez naloga).
  let hasMunro = false;
  const purchase = await db.transaction(async (tx) => {
    const [p] = await tx.insert(purchases).values({
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

    for (let i = 0; i < data.nalozi.length; i++) {
      const n = data.nalozi[i];
      if (n.orderKind === "munro") hasMunro = true;
      const nalogTotal = n.items.reduce((s, it) => s + (it.unitPrice ?? 0) * (it.quantity ?? 1), 0);

      const [order] = await tx.insert(orders).values({
        companyId,
        orderNumber: nalogNumbers[i],
        customerId: data.customerId,
        purchaseId: p.id,
        orderKind: n.orderKind,
        nalogStatus: "naruceno",
        productionFlow: n.orderKind === "munro" ? "munro" : "millimeter",
        dueDate: n.dueDate || null,
        totalAmount: String(nalogTotal),
        notes: n.notes || null,
        createdBy: user.id,
        // Mere idu uz naloge koji se šiju, ne uz gotovu robu
        measurementSnapshot: n.orderKind !== "gotov" ? measurementSnapshot : null,
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
      await tx.insert(orderItems).values(itemsToInsert);
    }

    // — Avans kao uplata —
    if (avans > 0) {
      await tx.insert(payments).values({
        companyId,
        referenceType: "purchase",
        referenceId: p.id,
        customerId: data.customerId,
        amount: String(avans),
        paymentMethod: data.paymentMethod ?? "cash",
        paymentDate: new Date().toISOString().split("T")[0],
        notes: "Avans pri naručivanju",
        createdBy: user.id,
      });
    }

    return p;
  });

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

// ─── getNalozi — lista pojedinačnih naloga za praćenje proizvodnje ────────────
// Radnici u radnji prate status svakog naloga posebno (Aleksandrov zahtjev:
// "200 košulja... da svako zna dokle je stigla koja"). Vraća naloge sa stavkama,
// klijentom i porudžbinom (radi avansa/plaćanja na nivou porudžbine).
export async function getNalozi() {
  const { dbUser } = await getCurrentUser();
  return db.query.orders.findMany({
    where: (o, { eq }) => eq(o.companyId, dbUser.companyId!),
    with: {
      customer: true,
      items: true,
      purchase: true,
    },
    orderBy: (o, { desc }) => [desc(o.createdAt)],
  });
}

// ─── getNaloziForProduction — aktivni nalozi za Kanban tablu ──────────────────
// Vraća naloge koji su još u toku (nisu preuzeti ni otkazani), sa klijentom i
// stavkama, radi praćenja faze izrade po nalogu.
export async function getNaloziForProduction() {
  const { dbUser } = await getCurrentUser();
  return db.query.orders.findMany({
    where: (o, { eq, and, notInArray }) =>
      and(
        eq(o.companyId, dbUser.companyId!),
        notInArray(o.nalogStatus, ["preuzeto", "otkazano"]),
      ),
    with: {
      customer: true,
      items: true,
    },
    orderBy: (o, { asc }) => [asc(o.dueDate)],
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
const NALOG_STATUSES = [
  "naruceno", "ceka_materijal", "za_izradu", "izrada",
  "gotovo", "u_radnji", "preuzeto", "korekcija", "otkazano",
] as const;
type NalogStatusValue = (typeof NALOG_STATUSES)[number];

export async function updateNalogStatus(nalogId: string, status: NalogStatusValue) {
  const { dbUser } = await getCurrentUser();
  // Runtime provjera — TypeScript tip ne štiti od ručno pozvane server akcije
  if (!NALOG_STATUSES.includes(status)) throw new Error("Nepoznat status naloga.");
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

  // Transakcija + atomski increment (dvije istovremene uplate se ne gube)
  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      companyId,
      referenceType: "purchase",
      referenceId: purchaseId,
      customerId: purchase.customerId,
      amount: String(amount),
      paymentMethod: method,
      paymentDate: new Date().toISOString().split("T")[0],
      createdBy: user.id,
    });

    await tx.update(purchases)
      .set({
        paidAmount: sql`paid_amount + ${amount}`,
        paymentStatus: sql`CASE
          WHEN paid_amount + ${amount} >= total_amount AND total_amount > 0 THEN 'paid'
          WHEN paid_amount + ${amount} > 0 THEN 'avans'
          ELSE 'unpaid' END`,
        updatedAt: new Date(),
      })
      .where(and(eq(purchases.id, purchaseId), eq(purchases.companyId, companyId)));
  });

  revalidatePath("/orders");
}
