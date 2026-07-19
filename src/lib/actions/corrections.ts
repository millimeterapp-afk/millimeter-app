"use server";

import { db } from "@/lib/db";
import { corrections } from "@/lib/db/schema";

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
  return { user, dbUser };
}

export async function getCorrections() {
  const { dbUser } = await getCurrentUser();

  return db
    .select()
    .from(corrections)
    .where(eq(corrections.companyId, dbUser.companyId!))
    .orderBy(desc(corrections.createdAt));
}

export async function createCorrection(data: {
  orderId?: string;
  customerId?: string;
  correctionType: string;
  description: string;
  cause?: string;
  dueDate?: string;
  affectsTemplate?: boolean;
  templateNote?: string;
}) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // — Validacija —
  if (!data.description || !data.description.trim()) throw new Error("Opis korekcije je obavezan.");
  // Nalog / klijent (ako su navedeni) moraju pripadati firmi
  if (data.orderId) {
    const o = await db.query.orders.findFirst({
      where: (o, { eq, and }) => and(eq(o.id, data.orderId!), eq(o.companyId, companyId)),
    });
    if (!o) throw new Error("Nalog nije pronađen.");
  }
  if (data.customerId) {
    const c = await db.query.customers.findFirst({
      where: (c, { eq, and, isNull }) =>
        and(eq(c.id, data.customerId!), eq(c.companyId, companyId), isNull(c.deletedAt)),
    });
    if (!c) throw new Error("Klijent nije pronađen.");
  }

  const [correction] = await db
    .insert(corrections)
    .values({
      companyId,
      orderId: data.orderId || null,
      customerId: data.customerId || null,
      correctionType: data.correctionType,
      description: data.description,
      cause: data.cause || null,
      status: "open",
      affectsTemplate: data.affectsTemplate ?? false,
      templateNote: data.templateNote || null,
      dueDate: data.dueDate || null,
      createdBy: user.id,
    })
    .returning();

  revalidatePath("/corrections");
  if (data.orderId) revalidatePath(`/orders/${data.orderId}`);
  if (data.customerId) revalidatePath(`/customers/${data.customerId}`);
  return correction;
}

export async function updateCorrectionStatus(
  id: string,
  status: "open" | "in_production" | "resolved" | "not_resolved",
  solution?: string
) {
  const { dbUser } = await getCurrentUser();

  const updates: Record<string, unknown> = { status };
  if (solution) updates.solution = solution;
  if (status === "resolved" || status === "not_resolved") {
    updates.resolvedAt = new Date();
  }

  await db
    .update(corrections)
    .set(updates)
    .where(and(eq(corrections.id, id), eq(corrections.companyId, dbUser.companyId!)));

  const correction = await db.query.corrections.findFirst({
    where: (c, { eq }) => eq(c.id, id),
  });

  revalidatePath("/corrections");
  if (correction?.orderId) revalidatePath(`/orders/${correction.orderId}`);
  if (correction?.customerId) revalidatePath(`/customers/${correction.customerId}`);
}
