"use server";

import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";

import { eq, and, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
  return { user, dbUser };
}

export async function getAppointments(from?: string, to?: string) {
  const { dbUser } = await getCurrentUser();

  const conditions = [eq(appointments.companyId, dbUser.companyId!)];
  if (from) conditions.push(gte(appointments.scheduledAt, new Date(from)));
  if (to) conditions.push(lte(appointments.scheduledAt, new Date(to)));

  return db.query.appointments.findMany({
    where: (a, { and }) => and(...conditions),
    with: { customer: true },
    orderBy: (a, { asc }) => [asc(a.scheduledAt)],
  });
}

export async function createAppointment(data: {
  customerId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  type?: string;
  notes?: string;
}) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // — Validacija —
  const when = new Date(data.scheduledAt);
  if (isNaN(when.getTime())) throw new Error("Neispravan datum termina.");
  const duration = data.durationMinutes ?? 60;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1440)
    throw new Error("Trajanje mora biti između 1 i 1440 minuta.");
  // Klijent (ako je naveden) mora pripadati firmi
  if (data.customerId) {
    const cust = await db.query.customers.findFirst({
      where: (c, { eq, and, isNull }) =>
        and(eq(c.id, data.customerId!), eq(c.companyId, companyId), isNull(c.deletedAt)),
    });
    if (!cust) throw new Error("Klijent nije pronađen.");
  }

  const [appt] = await db
    .insert(appointments)
    .values({
      companyId,
      customerId: data.customerId || null,
      scheduledAt: when,
      durationMinutes: duration,
      type: data.type ?? "merenje",
      status: "scheduled",
      notes: data.notes || null,
      createdBy: user.id,
    })
    .returning();

  revalidatePath("/appointments");
  return appt;
}

export async function updateAppointmentStatus(
  id: string,
  status: "scheduled" | "completed" | "cancelled" | "no_show"
) {
  const { dbUser } = await getCurrentUser();

  await db
    .update(appointments)
    .set({ status })
    .where(and(eq(appointments.id, id), eq(appointments.companyId, dbUser.companyId!)));

  revalidatePath("/appointments");
}

export async function updateAppointment(
  id: string,
  data: {
    customerId?: string;
    scheduledAt?: string;
    durationMinutes?: number;
    type?: string;
    notes?: string;
  }
) {
  const { dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // Validacija termina/trajanja ako se mijenjaju
  if (data.scheduledAt && isNaN(new Date(data.scheduledAt).getTime()))
    throw new Error("Neispravan datum termina.");
  if (data.durationMinutes !== undefined &&
      (!Number.isFinite(data.durationMinutes) || data.durationMinutes <= 0 || data.durationMinutes > 1440))
    throw new Error("Trajanje mora biti između 1 i 1440 minuta.");

  // Ako se mijenja klijent — mora pripadati firmi
  if (data.customerId) {
    const cust = await db.query.customers.findFirst({
      where: (c, { eq, and, isNull }) =>
        and(eq(c.id, data.customerId!), eq(c.companyId, companyId), isNull(c.deletedAt)),
    });
    if (!cust) throw new Error("Klijent nije pronađen.");
  }

  await db
    .update(appointments)
    .set({
      ...(data.customerId !== undefined && { customerId: data.customerId || null }),
      ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    })
    .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)));

  revalidatePath("/appointments");
}

export async function getCustomerAppointments(customerId: string) {
  const { dbUser } = await getCurrentUser();

  return db.query.appointments.findMany({
    where: (a, { and, eq }) =>
      and(eq(a.companyId, dbUser.companyId!), eq(a.customerId, customerId)),
    orderBy: (a, { desc }) => [desc(a.scheduledAt)],
  });
}

export async function deleteAppointment(id: string) {
  const { dbUser } = await getCurrentUser();

  await db
    .delete(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, dbUser.companyId!)));

  revalidatePath("/appointments");
}
