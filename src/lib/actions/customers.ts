"use server";

import { db } from "@/lib/db";
import { customers, customerMeasurements, orders } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, desc, ilike, or, isNull, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { addGoCreateCustomer, searchGoCreateCustomerByName, getGoCreateOrders } from "@/lib/gocreate";

async function getCompanyId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  const dbUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user.id),
  });
  if (!dbUser?.companyId) throw new Error("Nemaš kompaniju");
  return dbUser.companyId;
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
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      },
      corrections: {
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      },
    },
  });
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
      firstVisitDate: new Date().toISOString().split("T")[0],
      lastVisitDate: new Date().toISOString().split("T")[0],
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  // Deaktiviraj stara merenja
  await db
    .update(customerMeasurements)
    .set({ isActive: false })
    .where(eq(customerMeasurements.customerId, customerId));

  // Upiši nova
  await db.insert(customerMeasurements).values({
    customerId,
    label: "košulja",
    data,
    isActive: true,
    createdBy: user.id,
  });

  revalidatePath(`/customers/${customerId}`);
}

function calcLoyaltyTier(totalSpent: number): string {
  if (totalSpent >= 3000) return "Platinum";
  if (totalSpent >= 1500) return "Gold";
  if (totalSpent >= 500) return "Silver";
  return "Bronze";
}

export async function updateLoyaltyTier(customerId: string, newTotalSpent: number) {
  const tier = calcLoyaltyTier(newTotalSpent);
  await db
    .update(customers)
    .set({ loyaltyTier: tier })
    .where(eq(customers.id, customerId));
}

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

  // Generiši retroaktivni broj naloga
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.companyId, companyId));
  const count = Number(result[0].count) + 1;
  const year = new Date(data.deliveredAt).getFullYear();
  const orderNumber = `RET-${year}-${String(count).padStart(4, "0")}`;

  await db.insert(orders).values({
    companyId,
    orderNumber,
    customerId,
    orderType: "custom",
    status: "delivered",
    createdBy: user.id,
    dueDate: data.deliveredAt,
    deliveredAt: new Date(data.deliveredAt),
    completedAt: new Date(data.deliveredAt),
    totalAmount: String(data.totalAmount),
    paidAmount: String(data.totalAmount),
    paymentStatus: "paid",
    item: data.item,
    notes: data.notes || null,
  });

  // Dohvati klijenta da proverim datume
  const existingCustomer = await db.query.customers.findFirst({
    where: (c, { eq }) => eq(c.id, customerId),
  });

  const updateData: Record<string, unknown> = {
    totalSpent: sql`total_spent + ${data.totalAmount}`,
    visitCount: sql`visit_count + 1`,
    updatedAt: new Date(),
  };

  // Ažuriraj lastVisitDate samo ako je nova kupovina novija
  if (!existingCustomer?.lastVisitDate || data.deliveredAt > existingCustomer.lastVisitDate) {
    updateData.lastVisitDate = data.deliveredAt;
  }
  // Ažuriraj firstVisitDate samo ako je nova kupovina starija
  if (!existingCustomer?.firstVisitDate || data.deliveredAt < existingCustomer.firstVisitDate) {
    updateData.firstVisitDate = data.deliveredAt;
  }

  // Ažuriraj statistiku klijenta
  await db
    .update(customers)
    .set(updateData)
    .where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)));

  const updated = await db.query.customers.findFirst({
    where: (c, { eq }) => eq(c.id, customerId),
  });
  if (updated) {
    await updateLoyaltyTier(customerId, Number(updated.totalSpent));
  }

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
      firstVisitDate: new Date().toISOString().split("T")[0],
      lastVisitDate: new Date().toISOString().split("T")[0],
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
  if (!customer?.goCreateCustomerId) return [];

  return getGoCreateOrders(Number(customer.goCreateCustomerId));
}
