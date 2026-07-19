"use server";

import { db } from "@/lib/db";
import { purchases, orders, orderItems, payments, customers } from "@/lib/db/schema";
import { requireActiveUser } from "@/lib/auth";
import { syncCustomerToGoCreate } from "@/lib/actions/customers";
import { calcLoyaltyTier } from "@/lib/loyalty";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { belgradeToday } from "@/lib/datetime";

// ─── Auth helper ────────────────────────────────────────────────────────────
async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
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
  idempotencyKey?: string; // isti ključ po formi — retry vraća postojeću porudžbinu
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

  // Idempotency — ako je isti zahtjev već prošao (retry posle timeout-a), vrati
  // postojeću porudžbinu umjesto da napravi duplu.
  if (data.idempotencyKey) {
    const existing = await db.query.purchases.findFirst({
      where: (p, { eq, and }) => and(eq(p.idempotencyKey, data.idempotencyKey!), eq(p.companyId, companyId)),
    });
    if (existing) return existing;
  }

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
      idempotencyKey: data.idempotencyKey || null,
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
        paymentDate: belgradeToday(),
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

// ─── getPayments — sve uplate firme (za tačan prihod po datumu naplate) ───────
// Grafikon naplate treba da knjiži novac u mjesec kad je STVARNO legao
// (avans u julu, doplata u avgustu = dva različita mjeseca), ne u mjesec porudžbine.
export async function getPayments() {
  const { dbUser } = await getCurrentUser();
  return db
    .select({ amount: payments.amount, paymentDate: payments.paymentDate })
    .from(payments)
    .where(eq(payments.companyId, dbUser.companyId!));
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

// ─── Preračun ukupnog porudžbine ──────────────────────────────────────────────
// Ukupno = zbir naloga koji NISU otkazani. Ponovo izračuna i status plaćanja.
// Jedna atomarna izjava — koristi se u više akcija (otkazivanje naloga, izmjena stavki).
const recalcPurchaseTotalsSql = (purchaseId: string, companyId: string) => sql`
  WITH t AS (
    SELECT COALESCE(SUM(total_amount), 0) AS total
    FROM orders WHERE purchase_id = ${purchaseId} AND company_id = ${companyId} AND nalog_status <> 'otkazano'
  )
  UPDATE purchases p
  SET total_amount = t.total,
      payment_status = CASE
        WHEN p.paid_amount >= t.total AND t.total > 0 THEN 'paid'
        WHEN p.paid_amount > 0 THEN 'avans'
        ELSE 'unpaid' END,
      updated_at = now()
  FROM t
  WHERE p.id = ${purchaseId} AND p.company_id = ${companyId}
`;

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
  const companyId = dbUser.companyId!;

  await db.transaction(async (tx) => {
    // 1) Pronađi nalog (scoped) da saznamo porudžbinu
    const peek = await tx.query.orders.findFirst({
      where: (o, { eq, and }) => and(eq(o.id, nalogId), eq(o.companyId, companyId)),
    });
    if (!peek) throw new Error("Nalog nije pronađen.");

    // 2) ZAKLJUČAVANJE (uvijek istim redoslijedom: porudžbina pa nalog).
    // Bez ovoga dva PARALELNA zahtjeva oba pročitaju staro stanje i novac se
    // knjiži duplo — sekvencijalni "dupli klik" test to ne hvata.
    if (peek.purchaseId) {
      await tx.execute(sql`SELECT id FROM purchases WHERE id = ${peek.purchaseId} AND company_id = ${companyId} FOR UPDATE`);
    }
    const lockedRows = (await tx.execute(
      sql`SELECT id, nalog_status, total_amount, customer_id, purchase_id
          FROM orders WHERE id = ${nalogId} AND company_id = ${companyId} FOR UPDATE`
    )) as unknown as { id: string; nalog_status: string; total_amount: string; customer_id: string | null; purchase_id: string | null }[];
    const before = lockedRows[0];
    if (!before) throw new Error("Nalog nije pronađen.");
    if (before.nalog_status === status) return; // no-op — drugi zahtjev je već prošao

    await tx.update(orders)
      .set({ nalogStatus: status, updatedAt: new Date() })
      .where(and(eq(orders.id, nalogId), eq(orders.companyId, companyId)));

    // Otkazivanje/vraćanje naloga mijenja ukupno porudžbine — preračunaj
    if (before.purchase_id) await tx.execute(recalcPurchaseTotalsSql(before.purchase_id, companyId));

    // ─── Statistika klijenta ─────────────────────────────────────────────
    // Novac se pripisuje kad nalog stvarno ode klijentu ("preuzeto"),
    // i skida ako se vrati nazad (npr. u korekciju).
    const usaoUPreuzeto = status === "preuzeto";
    const izasaoIzPreuzeto = before.nalog_status === "preuzeto";
    if (before.customer_id && (usaoUPreuzeto || izasaoIzPreuzeto)) {
      const delta = usaoUPreuzeto ? Number(before.total_amount) : -Number(before.total_amount);

      const [updated] = await tx.update(customers)
        .set({
          totalSpent: sql`GREATEST(total_spent + ${delta}, 0)`,
          updatedAt: new Date(),
        })
        .where(and(eq(customers.id, before.customer_id), eq(customers.companyId, companyId)))
        .returning({ totalSpent: customers.totalSpent });

      if (updated) {
        await tx.update(customers)
          .set({ loyaltyTier: calcLoyaltyTier(Number(updated.totalSpent)) })
          .where(and(eq(customers.id, before.customer_id), eq(customers.companyId, companyId)));
      }

      // Posjeta se broji po PORUDŽBINI, ne po nalogu — svadba sa tri naloga
      // je jedan dolazak. Broji se kad zadnji aktivan nalog porudžbine ode.
      if (usaoUPreuzeto) {
        let porudzbinaZavrsena = true;
        if (before.purchase_id) {
          const preostali = await tx.query.orders.findMany({
            where: (o, { eq, and, notInArray }) =>
              and(eq(o.purchaseId, before.purchase_id!), notInArray(o.nalogStatus, ["preuzeto", "otkazano"])),
          });
          porudzbinaZavrsena = preostali.length === 0;
        }
        if (porudzbinaZavrsena) {
          const danas = belgradeToday();
          await tx.update(customers)
            .set({
              visitCount: sql`visit_count + 1`,
              lastVisitDate: danas,
              firstVisitDate: sql`COALESCE(first_visit_date, ${danas})`,
            })
            .where(and(eq(customers.id, before.customer_id), eq(customers.companyId, companyId)));
          if (before.purchase_id) {
            await tx.update(purchases)
              .set({ status: "completed", updatedAt: new Date() })
              .where(and(eq(purchases.id, before.purchase_id), eq(purchases.companyId, companyId)));
          }
        }
      }

      // SIMETRIJA za izlazak iz "preuzeto": ako je porudžbina bila završena,
      // vrati je na "open" i poništi posjetu — inače povratak u korekciju
      // ostavlja lažnu posjetu, a ponovno preuzimanje je broji drugi put.
      if (izasaoIzPreuzeto) {
        let bilaZavrsena = false;
        if (before.purchase_id) {
          const p = (await tx.execute(
            sql`SELECT status FROM purchases WHERE id = ${before.purchase_id} AND company_id = ${companyId}`
          )) as unknown as { status: string }[];
          bilaZavrsena = p[0]?.status === "completed";
          if (bilaZavrsena) {
            await tx.update(purchases)
              .set({ status: "open", updatedAt: new Date() })
              .where(and(eq(purchases.id, before.purchase_id), eq(purchases.companyId, companyId)));
          }
        } else {
          bilaZavrsena = true; // legacy nalog bez porudžbine — posjeta je knjižena pri preuzimanju
        }
        if (bilaZavrsena) {
          await tx.update(customers)
            .set({ visitCount: sql`GREATEST(visit_count - 1, 0)` })
            .where(and(eq(customers.id, before.customer_id), eq(customers.companyId, companyId)));
        }
      }
    }
  });

  revalidatePath("/orders");
  revalidatePath("/production");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

// ─── updateOrderItems — izmjena stavki naloga poslije kreiranja ────────────────
// Zamjenjuje stavke naloga i preračunava ukupno naloga i porudžbine.
// Sprječava "otkaži pa napravi novo" kad se pogriješi cijena/količina/artikal.
interface EditItem {
  artikal: string;
  quantity: number;
  unitPrice: number;
  material?: string;
  templateNumber?: string;
  collarType?: string;
  cuffType?: string;
  fitType?: string;
  measurementSnapshot?: Record<string, unknown> | null;
  monogramData?: Record<string, unknown> | null;
}

export async function updateOrderItems(orderId: string, items: EditItem[]) {
  const { dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  if (!Array.isArray(items) || items.length === 0)
    throw new Error("Nalog mora imati bar jednu stavku.");
  for (const it of items) {
    if (!it.artikal || !it.artikal.trim()) throw new Error("Svaka stavka mora imati artikal.");
    if (!Number.isFinite(it.quantity) || it.quantity < 1) throw new Error("Količina mora biti broj ≥ 1.");
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new Error("Cena mora biti broj ≥ 0.");
  }

  // Nalog mora pripadati firmi (cross-tenant zaštita)
  const order = await db.query.orders.findFirst({
    where: (o, { eq, and }) => and(eq(o.id, orderId), eq(o.companyId, companyId)),
  });
  if (!order) throw new Error("Nalog nije pronađen.");

  const nalogTotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  await db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await tx.insert(orderItems).values(items.map((it) => ({
      orderId,
      artikal: it.artikal.trim(),
      quantity: it.quantity,
      unitPrice: String(it.unitPrice),
      totalPrice: String(it.unitPrice * it.quantity),
      material: it.material || null,
      templateNumber: it.templateNumber || null,
      collarType: it.collarType || null,
      cuffType: it.cuffType || null,
      fitType: it.fitType || null,
      measurementSnapshot: it.measurementSnapshot ?? null,
      monogramData: it.monogramData ?? null,
    })));
    await tx.update(orders)
      .set({ totalAmount: String(nalogTotal), updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.companyId, companyId)));
    if (order.purchaseId) await tx.execute(recalcPurchaseTotalsSql(order.purchaseId, companyId));
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
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
  if (!["cash", "card", "transfer"].includes(method)) throw new Error("Nepoznat način plaćanja.");

  // Zaključavanje porudžbine: paralelna dupla uplata (dva taba, retry) inače
  // upiše obje i pređe preko ukupnog iznosa.
  await db.transaction(async (tx) => {
    const rows = (await tx.execute(
      sql`SELECT id, customer_id, total_amount, paid_amount FROM purchases
          WHERE id = ${purchaseId} AND company_id = ${companyId} FOR UPDATE`
    )) as unknown as { id: string; customer_id: string; total_amount: string; paid_amount: string }[];
    const purchase = rows[0];
    if (!purchase) throw new Error("Porudžbina nije pronađena.");

    const remaining = Number(purchase.total_amount) - Number(purchase.paid_amount);
    if (amount > remaining + 0.005) {
      throw new Error(`Iznos je veći od preostalog duga (RSD ${Math.max(0, Math.round(remaining)).toLocaleString("sr-RS")}).`);
    }

    await tx.insert(payments).values({
      companyId,
      referenceType: "purchase",
      referenceId: purchaseId,
      customerId: purchase.customer_id,
      amount: String(amount),
      paymentMethod: method,
      paymentDate: belgradeToday(),
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
