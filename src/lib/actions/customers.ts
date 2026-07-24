"use server";

import { db } from "@/lib/db";
import { customers, customerMeasurements, orders, munroOrders } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, desc, ilike, or, isNull, and, sql, inArray, type AnyColumn, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { belgradeToday } from "@/lib/datetime";
import * as XLSX from "xlsx";
import { addGoCreateCustomer, searchGoCreateCustomerByName, getGoCreateOrders, getGoCreateOrdersSafe } from "@/lib/gocreate";
import { calcLoyaltyTier } from "@/lib/loyalty";
import { requireActiveUser } from "@/lib/auth";

async function getCompanyId() {
  const { companyId } = await requireActiveUser();
  return companyId;
}

// ─── Brze akcije za velike liste (4.000+ klijenata) ──────────────────────────
// Puna lista NE ide u browser — server vraća stranicu / top-N / agregate.

// Pretraga tolerantna na "ime prezime" I na dijakritiku: upit se razbije na riječi,
// svaka mora da se nađe u nekom polju. Srpska slova se presavijaju (š/č/ć/ž → s/c/c/z,
// đ → dj) ISTO u JS i u SQL, pa "Milic" nalazi "Milić" i obrnuto. Telefon se poredi
// samo po ciframa (ignoriše razmake, crtice, +).
function foldSr(s: string): string {
  return s
    .replace(/[šŠ]/g, "s").replace(/[čČćĆ]/g, "c").replace(/[žŽ]/g, "z")
    .replace(/[đĐ]/g, "dj")
    .toLowerCase();
}
function foldColSql(col: AnyColumn) {
  return sql`lower(replace(replace(translate(${col}, ${"šŠčČćĆžŽ"}, ${"sScCcCzZ"}), 'đ', 'dj'), 'Đ', 'dj'))`;
}
function buildCustomerSearch(q: string) {
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;
  return and(
    ...tokens.map((t) => {
      const like = `%${foldSr(t)}%`;
      const digits = t.replace(/[^0-9]/g, "");
      const parts = [
        sql`${foldColSql(customers.firstName)} LIKE ${like}`,
        sql`${foldColSql(customers.lastName)} LIKE ${like}`,
        sql`lower(${customers.email}) LIKE ${`%${t.toLowerCase()}%`}`,
      ];
      if (digits.length >= 2) {
        parts.push(sql`regexp_replace(${customers.phone}, '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`);
      }
      return or(...parts)!;
    })
  );
}

export async function getCustomersPage(search: string, page: number, pageSize = 25, noPhoneOnly = false) {
  const companyId = await getCompanyId();
  const conditions = [eq(customers.companyId, companyId), isNull(customers.deletedAt)];
  const q = (search || "").trim();
  if (q) {
    const sc = buildCustomerSearch(q);
    if (sc) conditions.push(sc);
  }
  // Filter "bez broja" — klijenti bez telefona (uglavnom uvezeni iz Munra), za brzi unos
  if (noPhoneOnly) conditions.push(sql`NULLIF(TRIM(${customers.phone}), '') IS NULL`);
  const safePage = Math.max(1, Math.floor(page) || 1);
  const [rows, cnt] = await Promise.all([
    db.select().from(customers).where(and(...conditions))
      .orderBy(customers.lastName, customers.firstName)
      .limit(pageSize).offset((safePage - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(customers).where(and(...conditions)),
  ]);
  return { customers: rows, total: Number(cnt[0].count) };
}

// Laka pretraga za birače klijenata (wizard i sl.) — vraća max 20
export async function searchCustomersLite(query: string, id?: string) {
  const companyId = await getCompanyId();
  if (id) {
    return db.select().from(customers)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId), isNull(customers.deletedAt)))
      .limit(1);
  }
  const q = (query || "").trim();
  if (q.length < 2) return [];
  return db.select().from(customers)
    .where(and(
      eq(customers.companyId, companyId),
      isNull(customers.deletedAt),
      buildCustomerSearch(q)
    ))
    .orderBy(customers.lastName, customers.firstName)
    .limit(20);
}

// ─── Spajanje klijenata (dedup) ───────────────────────────────────────────────
// Spaja duplikate (loseIds) u jednog koji ostaje (keepId): prebaci SVU istoriju,
// popuni prazna polja keep-a, saberi novac/posjete/poene, pa soft-briši duplikate.
// Aleksandar ovim spaja sam u aplikaciji, bez "peške pa šaljem Mateju".
const nonEmpty = (v: unknown) => v != null && String(v).trim() !== "";

export async function mergeCustomers(keepId: string, loseIds: string[]) {
  const companyId = await getCompanyId();
  const losers = [...new Set(loseIds)].filter((id) => id && id !== keepId);
  if (losers.length === 0) throw new Error("Nema koga da se spoji.");

  await db.transaction(async (tx) => {
    // Zaključaj sve u sortiranom redoslijedu (izbjegava deadlock kod paralelnih merge-ova)
    const allIds = [keepId, ...losers].sort();
    for (const id of allIds) {
      await tx.execute(sql`SELECT id FROM customers WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`);
    }

    const rows = await tx.select().from(customers)
      .where(and(inArray(customers.id, allIds), eq(customers.companyId, companyId)));
    const keep = rows.find((r) => r.id === keepId);
    if (!keep || keep.deletedAt) throw new Error("Klijent koji ostaje nije pronađen.");
    // Svi izabrani moraju postojati, pripadati firmi i ne biti obrisani — inače prekini
    // cijeli merge (bez tihog djelimičnog spajanja koje bi vratilo pogrešan broj).
    if (rows.length !== allIds.length || rows.some((r) => r.deletedAt)) {
      throw new Error("Neki od izabranih klijenata više ne postoji ili je obrisan. Osvježi stranicu.");
    }
    // Determinističan redoslijed (po redoslijedu loseIds) da izbor praznih polja bude stabilan.
    const loseRows = losers.map((id) => rows.find((r) => r.id === id)!);
    const realLosers = loseRows.map((r) => r.id);

    // Aktivan set mera keep-a PRIJE premeštanja (za kanonski izbor kasnije).
    const keepActive = (await tx.execute(sql`
      SELECT id FROM customer_measurements WHERE customer_id = ${keepId} AND is_active = true
      ORDER BY created_at DESC LIMIT 1`)) as unknown as { id: string }[];

    // 1) Prebaci sve reference. Tabele SA company_id:
    for (const lid of realLosers) {
      for (const t of ["purchases", "orders", "munro_orders", "corrections", "sales", "payments", "appointments"]) {
        await tx.execute(sql`UPDATE ${sql.raw(t)} SET customer_id = ${keepId} WHERE customer_id = ${lid} AND company_id = ${companyId}`);
      }
      // Tabele BEZ company_id (lid je već potvrđen da pripada firmi):
      for (const t of ["customer_measurements", "loyalty_events"]) {
        await tx.execute(sql`UPDATE ${sql.raw(t)} SET customer_id = ${keepId} WHERE customer_id = ${lid}`);
      }
    }

    // Samo JEDAN aktivan set mera na keep-u (keep-ov ako je imao, inače najnoviji od
    // spojenih); ostale ugasi — inače profil/novi nalog uzimaju mere nasumičnog duplikata.
    let canonicalMeas = keepActive[0]?.id ?? null;
    if (!canonicalMeas) {
      const newest = (await tx.execute(sql`
        SELECT id FROM customer_measurements WHERE customer_id = ${keepId} AND is_active = true
        ORDER BY created_at DESC LIMIT 1`)) as unknown as { id: string }[];
      canonicalMeas = newest[0]?.id ?? null;
    }
    if (canonicalMeas) {
      await tx.execute(sql`UPDATE customer_measurements SET is_active = false
        WHERE customer_id = ${keepId} AND is_active = true AND id <> ${canonicalMeas}`);
    }

    // 2) Popuni prazna polja keep-a iz duplikata; saberi novac/posjete/poene
    const pick = <T,>(cur: T, alts: T[]): T => (nonEmpty(cur) ? cur : (alts.find(nonEmpty) ?? cur));
    const fv = [keep.firstVisitDate, ...loseRows.map((r) => r.firstVisitDate)].filter(Boolean).sort() as string[];
    const lv = [keep.lastVisitDate, ...loseRows.map((r) => r.lastVisitDate)].filter(Boolean).sort() as string[];
    const notesParts = [keep.notes, ...loseRows.map((r) => r.notes)].filter(nonEmpty) as string[];
    const totalSpent = [keep, ...loseRows].reduce((s, r) => s + Number(r.totalSpent || 0), 0);
    const visitCount = [keep, ...loseRows].reduce((s, r) => s + Number(r.visitCount || 0), 0);
    const loyaltyPoints = [keep, ...loseRows].reduce((s, r) => s + Number(r.loyaltyPoints || 0), 0);

    await tx.update(customers).set({
      phone: pick(keep.phone, loseRows.map((r) => r.phone)),
      email: pick(keep.email, loseRows.map((r) => r.email)),
      city: pick(keep.city, loseRows.map((r) => r.city)),
      address: pick(keep.address, loseRows.map((r) => r.address)),
      dateOfBirth: pick(keep.dateOfBirth, loseRows.map((r) => r.dateOfBirth)),
      templateNumber: pick(keep.templateNumber, loseRows.map((r) => r.templateNumber)),
      goCreateCustomerId: pick(keep.goCreateCustomerId, loseRows.map((r) => r.goCreateCustomerId)),
      notes: notesParts.length ? notesParts.join(" | ") : null,
      totalSpent: String(totalSpent),
      visitCount,
      loyaltyPoints,
      loyaltyTier: calcLoyaltyTier(totalSpent),
      firstVisitDate: fv[0] ?? null,
      lastVisitDate: lv.length ? lv[lv.length - 1] : null,
      updatedAt: new Date(),
    }).where(and(eq(customers.id, keepId), eq(customers.companyId, companyId)));

    // 3) Soft-briši duplikate
    await tx.update(customers).set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(inArray(customers.id, realLosers), eq(customers.companyId, companyId)));
  });

  revalidatePath("/customers");
  revalidatePath("/customers/duplikati");
  return { merged: losers.length, ok: true };
}

// ─── Kandidati za spajanje (dva pristupa) ─────────────────────────────────────
export type DupMember = { id: string; firstName: string; lastName: string; phone: string; munro: number; orders: number; totalSpent: number; lastVisit: string | null };
export type DupGroup = { key: string; members: DupMember[] };
export type VariantMatch = {
  noPhone: { id: string; firstName: string; lastName: string; munro: number };
  candidates: { id: string; firstName: string; lastName: string; phone: string; munro: number; totalSpent: number; lastVisit: string | null }[];
};

export async function getDuplicateCandidates(): Promise<{ exactDupes: DupGroup[]; nameVariants: VariantMatch[] }> {
  const companyId = await getCompanyId();

  // A) Isto ime+prezime, više unosa (imenjaci ILI isti čovjek dvaput)
  const exactRows = (await db.execute(sql`
    WITH n AS (
      SELECT c.id, c.first_name, c.last_name, c.phone, c.last_visit_date, c.total_spent,
        lower(trim(c.first_name) || ' ' || trim(c.last_name)) AS k,
        (SELECT count(*)::int FROM munro_orders mo WHERE mo.customer_id = c.id AND mo.company_id = ${companyId}) AS munro,
        (SELECT count(*)::int FROM orders o WHERE o.customer_id = c.id AND o.company_id = ${companyId}) AS orders
      FROM customers c
      WHERE c.company_id = ${companyId} AND c.deleted_at IS NULL
        AND trim(c.first_name) <> '' AND trim(c.last_name) <> ''
    ), d AS (SELECT k FROM n GROUP BY k HAVING count(*) > 1)
    SELECT id, first_name AS "firstName", last_name AS "lastName", phone,
           last_visit_date AS "lastVisit", total_spent AS "totalSpent", munro, orders, k
    FROM n WHERE k IN (SELECT k FROM d)
    ORDER BY k, last_name, first_name
    LIMIT 1000
  `)) as unknown as (DupMember & { k: string })[];

  const groupMap = new Map<string, DupMember[]>();
  for (const r of exactRows) {
    const arr = groupMap.get(r.k) ?? [];
    arr.push({ id: r.id, firstName: r.firstName, lastName: r.lastName, phone: r.phone,
      munro: Number(r.munro), orders: Number(r.orders), totalSpent: Number(r.totalSpent), lastVisit: r.lastVisit });
    groupMap.set(r.k, arr);
  }
  const exactDupes: DupGroup[] = [...groupMap.entries()].map(([key, members]) => ({ key, members }));

  // B) Isto prezime + isto prvo slovo imena; jedan BEZ broja (iz Munra) + jedan SA brojem
  //    (hvata "Eki/Elvir" varijantu imena koju exact-match ne vidi)
  const variantRows = (await db.execute(sql`
    WITH np AS (
      SELECT c.id, c.first_name, c.last_name, lower(trim(c.last_name)) AS ln, left(lower(trim(c.first_name)),1) AS fi,
        (SELECT count(*)::int FROM munro_orders mo WHERE mo.customer_id = c.id AND mo.company_id = ${companyId}) AS munro
      FROM customers c
      WHERE c.company_id = ${companyId} AND c.deleted_at IS NULL
        AND NULLIF(trim(c.phone),'') IS NULL AND trim(c.last_name) <> '' AND trim(c.first_name) <> ''
    ), wp AS (
      SELECT c.id, c.first_name, c.last_name, c.phone, lower(trim(c.last_name)) AS ln, left(lower(trim(c.first_name)),1) AS fi,
        c.last_visit_date, c.total_spent,
        (SELECT count(*)::int FROM munro_orders mo WHERE mo.customer_id = c.id AND mo.company_id = ${companyId}) AS munro
      FROM customers c
      WHERE c.company_id = ${companyId} AND c.deleted_at IS NULL
        AND NULLIF(trim(c.phone),'') IS NOT NULL AND trim(c.last_name) <> '' AND trim(c.first_name) <> ''
    )
    SELECT np.id AS "npId", np.first_name AS "npFirst", np.last_name AS "npLast", np.munro AS "npMunro",
           wp.id AS "wpId", wp.first_name AS "wpFirst", wp.last_name AS "wpLast", wp.phone AS "wpPhone",
           wp.munro AS "wpMunro", wp.last_visit_date AS "wpLastVisit", wp.total_spent AS "wpTotalSpent"
    FROM np JOIN wp ON wp.ln = np.ln AND wp.fi = np.fi
    ORDER BY np.last_name, np.first_name
    LIMIT 600
  `)) as unknown as Record<string, string | number | null>[];

  const varMap = new Map<string, VariantMatch>();
  for (const r of variantRows) {
    const npId = String(r.npId);
    let v = varMap.get(npId);
    if (!v) {
      v = { noPhone: { id: npId, firstName: String(r.npFirst), lastName: String(r.npLast), munro: Number(r.npMunro) }, candidates: [] };
      varMap.set(npId, v);
    }
    v.candidates.push({ id: String(r.wpId), firstName: String(r.wpFirst), lastName: String(r.wpLast),
      phone: String(r.wpPhone), munro: Number(r.wpMunro), totalSpent: Number(r.wpTotalSpent),
      lastVisit: r.wpLastVisit ? String(r.wpLastVisit) : null });
  }

  return { exactDupes, nameVariants: [...varMap.values()] };
}

// Agregati za dashboard/izvještaje — umjesto slanja svih klijenata u browser
export async function getCustomerStats() {
  const companyId = await getCompanyId();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [totalR, newR, top, loyaltyR] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt))),
    db.select({ count: sql<number>`count(*)` }).from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt),
        sql`created_at >= ${monthStart.toISOString()}`)),
    db.select({
      id: customers.id, firstName: customers.firstName, lastName: customers.lastName,
      totalSpent: customers.totalSpent,
    }).from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
      .orderBy(desc(customers.totalSpent)).limit(5),
    db.select({ tier: customers.loyaltyTier, count: sql<number>`count(*)` }).from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
      .groupBy(customers.loyaltyTier),
  ]);

  return {
    total: Number(totalR[0].count),
    newThisMonth: Number(newR[0].count),
    top,
    loyalty: Object.fromEntries(loyaltyR.map((r) => [r.tier, Number(r.count)])),
  };
}

export async function getCustomers(search?: string) {
  const companyId = await getCompanyId();

  const conditions = [
    eq(customers.companyId, companyId),
    isNull(customers.deletedAt),
  ];

  if (search) {
    conditions.push(
      or(
        ilike(customers.firstName, `%${search}%`),
        ilike(customers.lastName, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.email, `%${search}%`)
      )!
    );
  }

  return db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.createdAt));
}

export async function getCustomer(id: string) {
  const companyId = await getCompanyId();

  return db.query.customers.findFirst({
    where: (c, { eq, and, isNull }) =>
      and(eq(c.id, id), eq(c.companyId, companyId), isNull(c.deletedAt)),
    with: {
      measurements: {
        where: (m, { eq }) => eq(m.isActive, true),
      },
      orders: {
        with: { items: true },
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      },
      corrections: {
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      },
      munroOrders: {
        where: (m, { eq }) => eq(m.companyId, companyId),
        orderBy: (m, { desc }) => [desc(m.createdDate)],
      },
    },
  });
}

// ─── Top klijenti po Munro potrošnji za godinu (Nikolin zahtjev) ──────────────
export async function getTopMunroByYear(year: number) {
  const companyId = await getCompanyId();
  // Povezani nalozi se grupišu po customer_id, a ime se uzima iz tabele klijenata —
  // pa spojeni klijent (npr. Eki/Elvir) ostaje JEDAN red, ne dva sa podijeljenom
  // potrošnjom. customer_name se koristi samo za nepovezane Munro naloge.
  const rows = (await db.execute(sql`
    SELECT
      mo.customer_id AS "customerId",
      COALESCE(NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''), mo.customer_name) AS "customerName",
      count(*)::int AS orders,
      sum(mo.price)::float8 AS "totalEur"
    FROM munro_orders mo
    LEFT JOIN customers c ON c.id = mo.customer_id AND c.company_id = mo.company_id AND c.deleted_at IS NULL
    WHERE mo.company_id = ${companyId} AND mo.order_year = ${year}
    GROUP BY mo.customer_id, COALESCE(NULLIF(TRIM(c.first_name || ' ' || c.last_name), ''), mo.customer_name)
    ORDER BY sum(mo.price) DESC
    LIMIT 20
  `)) as unknown as { customerId: string | null; customerName: string; orders: number; totalEur: number }[];
  return rows.map((r) => ({ customerId: r.customerId, customerName: r.customerName, orders: Number(r.orders), totalEur: Number(r.totalEur) }));
}

// Godine za koje imamo Munro istoriju (za dropdown)
export async function getMunroYears() {
  const companyId = await getCompanyId();
  const rows = await db
    .select({ year: munroOrders.orderYear })
    .from(munroOrders)
    .where(and(eq(munroOrders.companyId, companyId), sql`order_year is not null`))
    .groupBy(munroOrders.orderYear)
    .orderBy(desc(munroOrders.orderYear));
  return rows.map((r) => r.year).filter((y): y is number => y != null);
}

// Provjera duplikata PRIJE unosa — vraća slične klijente (isto ime bez obzira na
// dijakritiku, ILI isti broj telefona po ciframa). NE blokira (moguć imenjak ili
// porodica na istom broju), samo daje formi da upozori i pita „svejedno dodaj?".
export async function findSimilarCustomers(input: { firstName: string; lastName: string; phone?: string }) {
  const companyId = await getCompanyId();
  const fFirst = foldSr((input.firstName || "").trim());
  const fLast = foldSr((input.lastName || "").trim());
  const digits = (input.phone || "").replace(/[^0-9]/g, "");
  const conds: SQL[] = [];
  if (fFirst && fLast) {
    conds.push(sql`(${foldColSql(customers.firstName)} = ${fFirst} AND ${foldColSql(customers.lastName)} = ${fLast})`);
  }
  if (digits.length >= 5) {
    conds.push(sql`regexp_replace(${customers.phone}, '[^0-9]', '', 'g') = ${digits}`);
  }
  if (conds.length === 0) return [];
  return db.select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone })
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt), or(...conds)!))
    .orderBy(customers.lastName, customers.firstName)
    .limit(6);
}

export async function createCustomer(data: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  dateOfBirth?: string;
  notes?: string;
  templateNumber?: string;
  measurements?: Record<string, string>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  const companyId = await getCompanyId();

  const [customer] = await db
    .insert(customers)
    .values({
      companyId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      city: data.city || null,
      address: data.address || null,
      dateOfBirth: data.dateOfBirth || null,
      notes: data.notes || null,
      templateNumber: data.templateNumber || null,
      firstVisitDate: belgradeToday(),
      lastVisitDate: belgradeToday(),
      createdBy: user.id,
    })
    .returning();

  if (data.measurements && Object.values(data.measurements).some(Boolean)) {
    await db.insert(customerMeasurements).values({
      customerId: customer.id,
      label: "košulja",
      data: data.measurements,
      createdBy: user.id,
    });
  }

  // GoCreate sync — ne blokira ako ne uspe
  try {
    const gc = await addGoCreateCustomer({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      ssid: customer.id,
    });

    let gcId = gc.id;
    if (!gcId && gc.alreadyExists) {
      gcId = await searchGoCreateCustomerByName(data.firstName, data.lastName);
    }

    if (gcId) {
      await db
        .update(customers)
        .set({ goCreateCustomerId: String(gcId), goCreateSyncedAt: new Date() })
        .where(eq(customers.id, customer.id));
    }
  } catch (err) {
    console.error("[GoCreate] sync failed for new customer:", err);
  }

  revalidatePath("/customers");
  return customer;
}

export async function updateCustomer(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    notes: string;
    templateNumber: string;
  }>
) {
  const companyId = await getCompanyId();

  await db
    .update(customers)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function saveMeasurements(
  customerId: string,
  data: Record<string, string>
) {
  const { user, companyId } = await requireActiveUser();

  // Klijent MORA pripadati firmi — bez ovoga bi UUID tuđeg klijenta
  // deaktivirao njegova merenja (cross-tenant pisanje)
  const customer = await db.query.customers.findFirst({
    where: (c, { eq, and, isNull }) =>
      and(eq(c.id, customerId), eq(c.companyId, companyId), isNull(c.deletedAt)),
  });
  if (!customer) throw new Error("Klijent nije pronađen.");

  // Deaktivacija starih + upis novih — jedna transakcija
  await db.transaction(async (tx) => {
    await tx
      .update(customerMeasurements)
      .set({ isActive: false })
      .where(eq(customerMeasurements.customerId, customerId));

    await tx.insert(customerMeasurements).values({
      customerId,
      label: "košulja",
      data,
      isActive: true,
      createdBy: user.id,
    });
  });

  revalidatePath(`/customers/${customerId}`);
}

// Pragovi lojalnosti su u RSD i žive u @/lib/loyalty. Nekadašnji javni
// updateLoyaltyTier je uklonjen — bio je server action bez autentikacije.

export async function addHistoricalPurchase(
  customerId: string,
  data: {
    item: string;
    totalAmount: number;
    deliveredAt: string;
    notes?: string;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");
  const companyId = await getCompanyId();

  if (!data.item?.trim()) throw new Error("Artikal je obavezan.");
  if (!Number.isFinite(data.totalAmount) || data.totalAmount < 0) throw new Error("Iznos mora biti broj ≥ 0.");
  const dts = new Date(data.deliveredAt);
  if (isNaN(dts.getTime())) throw new Error("Datum nije ispravan.");

  await db.transaction(async (tx) => {
    // Klijent MORA pripadati firmi i ne smije biti obrisan; zaključan (FOR KEY SHARE)
    // da ga paralelni merge ne soft-obriše dok pravimo nalog na njemu. Bez ove provjere
    // moglo se ubaciti nalog sa customer_id druge firme (cross-tenant) ili obrisanog.
    const custRows = (await tx.execute(sql`
      SELECT first_visit_date, last_visit_date FROM customers
      WHERE id = ${customerId} AND company_id = ${companyId} AND deleted_at IS NULL
      FOR KEY SHARE`)) as unknown as { first_visit_date: string | null; last_visit_date: string | null }[];
    const cust = custRows[0];
    if (!cust) throw new Error("Klijent nije pronađen.");

    const cnt = (await tx.execute(sql`SELECT count(*)::int AS c FROM orders WHERE company_id = ${companyId}`)) as unknown as { c: number }[];
    const orderNumber = `RET-${dts.getFullYear()}-${String(Number(cnt[0].c) + 1).padStart(4, "0")}`;

    await tx.insert(orders).values({
      companyId, orderNumber, customerId,
      orderType: "custom", orderKind: "domaca",
      status: "delivered", nalogStatus: "preuzeto",
      createdBy: user.id,
      dueDate: data.deliveredAt,
      deliveredAt: dts, completedAt: dts,
      totalAmount: String(data.totalAmount),
      paidAmount: String(data.totalAmount),
      paymentStatus: "paid",
      item: data.item.trim(), notes: data.notes || null,
    });

    const updateData: Record<string, unknown> = {
      totalSpent: sql`total_spent + ${data.totalAmount}`,
      visitCount: sql`visit_count + 1`,
      updatedAt: new Date(),
    };
    if (!cust.last_visit_date || data.deliveredAt > cust.last_visit_date) updateData.lastVisitDate = data.deliveredAt;
    if (!cust.first_visit_date || data.deliveredAt < cust.first_visit_date) updateData.firstVisitDate = data.deliveredAt;

    const [updated] = await tx.update(customers).set(updateData)
      .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)))
      .returning({ totalSpent: customers.totalSpent });
    if (updated) {
      await tx.update(customers).set({ loyaltyTier: calcLoyaltyTier(Number(updated.totalSpent)) })
        .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)));
    }
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function deleteCustomer(id: string) {
  const companyId = await getCompanyId();

  await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));

  revalidatePath("/customers");
}

export async function generateCustomerTemplate(): Promise<string> {
  const headers = ["Ime", "Prezime", "Telefon", "Email", "Adresa", "Grad", "Broj šablona", "Napomena"];
  const example = ["Marko", "Petrović", "+38269123456", "marko@email.com", "Bulevar Svetog Petra 5", "Podgorica", "42", "VIP klijent"];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Klijenti");

  return XLSX.write(wb, { bookType: "xlsx", type: "base64" }) as string;
}

export async function importCustomers(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  const companyId = await getCompanyId();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Fajl nije pronađen");

  const buffer = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const validRows = rows.filter((r) => r["Ime"] && r["Prezime"] && r["Telefon"]);
  const phones = validRows.map((r) => String(r["Telefon"]));

  // Proveri koji telefoni već postoje
  const existing = phones.length > 0
    ? await db
        .select({ phone: customers.phone })
        .from(customers)
        .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt), inArray(customers.phone, phones)))
    : [];
  const existingPhones = new Set(existing.map((e) => e.phone));

  const toInsert = validRows
    .filter((r) => !existingPhones.has(String(r["Telefon"])))
    .map((r) => ({
      companyId,
      firstName: String(r["Ime"]),
      lastName: String(r["Prezime"]),
      phone: String(r["Telefon"]),
      email: r["Email"] ? String(r["Email"]) : null,
      address: r["Adresa"] ? String(r["Adresa"]) : null,
      city: r["Grad"] ? String(r["Grad"]) : null,
      templateNumber: r["Broj šablona"] ? String(r["Broj šablona"]) : null,
      notes: r["Napomena"] ? String(r["Napomena"]) : null,
      firstVisitDate: belgradeToday(),
      lastVisitDate: belgradeToday(),
      createdBy: user.id,
    }));

  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await db.insert(customers).values(toInsert.slice(i, i + CHUNK));
  }

  revalidatePath("/customers");
  return { inserted: toInsert.length, skipped: existingPhones.size };
}

/**
 * Sinhronizuje klijenta u GoCreate i sačuva njihov ID u našoj bazi.
 * Sigurno za višestruko pozivanje — preskače ako je ID već sačuvan.
 */
export async function syncCustomerToGoCreate(
  customerId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const companyId = await getCompanyId();

    const customer = await db.query.customers.findFirst({
      where: (c, { eq, and, isNull }) =>
        and(eq(c.id, customerId), eq(c.companyId, companyId), isNull(c.deletedAt)),
    });
    if (!customer) return { ok: false, error: "Klijent nije pronađen." };

    if (customer.goCreateCustomerId) return { ok: true, id: customer.goCreateCustomerId };

    // Pokušaj dodavanje — bez ShopId (sa ShopId API kvari odgovor)
    const addResult = await addGoCreateCustomer({
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      ssid: customerId,
    });

    let goCreateId: number | null = addResult.id;

    // Klijent već postoji u GoCreate — nađi ga po imenu
    if (!goCreateId && addResult.alreadyExists) {
      goCreateId = await searchGoCreateCustomerByName(customer.firstName, customer.lastName);
    }

    if (!goCreateId) {
      return { ok: false, error: "GoCreate API nije vratio ID klijenta. Proverite Vercel Logs → filter 'GoCreate'." };
    }

    const goCreateCustomerId = String(goCreateId);

    await db
      .update(customers)
      .set({ goCreateCustomerId, goCreateSyncedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)));

    revalidatePath(`/customers/${customerId}`);
    return { ok: true, id: goCreateCustomerId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GoCreate] syncCustomer error:", msg);
    return { ok: false, error: msg };
  }
}

/** Dohvata Munro naloge za klijenta iz GoCreate (za prikaz statusa u UI). */
export async function fetchGoCreateOrdersForCustomer(customerId: string) {
  const companyId = await getCompanyId();

  const customer = await db.query.customers.findFirst({
    where: (c, { eq, and }) => and(eq(c.id, customerId), eq(c.companyId, companyId)),
  });
  if (!customer?.goCreateCustomerId) return { orders: [], unavailable: false };

  return getGoCreateOrdersSafe(Number(customer.goCreateCustomerId));
}
