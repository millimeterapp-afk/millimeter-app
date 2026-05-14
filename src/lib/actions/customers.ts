"use server";

import { db } from "@/lib/db";
import { customers, customerMeasurements, orders } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, desc, ilike, or, isNull, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

  // Dohvati klijenta da provjerim datume
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
