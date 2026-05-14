"use server";

import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

  const [appt] = await db
    .insert(appointments)
    .values({
      companyId: dbUser.companyId!,
      customerId: data.customerId || null,
      scheduledAt: new Date(data.scheduledAt),
      durationMinutes: data.durationMinutes ?? 60,
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

  await db
    .update(appointments)
    .set({
      ...(data.customerId !== undefined && { customerId: data.customerId || null }),
      ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    })
    .where(and(eq(appointments.id, id), eq(appointments.companyId, dbUser.companyId!)));

  revalidatePath("/appointments");
}

export async function deleteAppointment(id: string) {
  const { dbUser } = await getCurrentUser();

  await db
    .delete(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, dbUser.companyId!)));

  revalidatePath("/appointments");
}
