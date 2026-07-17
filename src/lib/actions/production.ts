"use server";

import { db } from "@/lib/db";
import { productionTasks, orders, corrections } from "@/lib/db/schema";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
  return { user, dbUser };
}

export async function getProductionCorrections() {
  const { dbUser } = await getCurrentUser();

  return db.query.corrections.findMany({
    where: (c, { eq, and }) =>
      and(eq(c.companyId, dbUser.companyId!), eq(c.status, "in_production")),
    with: {
      order: true,
      customer: true,
    },
    orderBy: (c, { asc }) => asc(c.dueDate),
  });
}

export async function getProductionTasks() {
  const { dbUser } = await getCurrentUser();

  return db.query.productionTasks.findMany({
    where: (pt, { eq }) => eq(pt.companyId, dbUser.companyId!),
    with: {
      order: {
        with: {
          customer: true,
        },
      },
    },
    orderBy: (pt, { asc }) => asc(pt.createdAt),
  });
}

export async function updateTaskStatus(
  id: string,
  status: "queued" | "in_progress" | "done" | "sent_to_store",
  note?: string
) {
  const { dbUser } = await getCurrentUser();

  const updates: Record<string, unknown> = { status };

  if (status === "in_progress") {
    updates.startedAt = new Date();
  }
  if (status === "done" || status === "sent_to_store") {
    updates.completedAt = new Date();
  }
  if (note) {
    updates.notesFromProduction = note;
  }

  await db
    .update(productionTasks)
    .set(updates)
    .where(
      and(eq(productionTasks.id, id), eq(productionTasks.companyId, dbUser.companyId!))
    );

  // Kada produkcija pošalje u radnju → automatski ažuriraj status naloga na "ready"
  if (status === "sent_to_store") {
    const task = await db.query.productionTasks.findFirst({
      where: (pt, { eq }) => eq(pt.id, id),
    });
    if (task?.orderId) {
      await db
        .update(orders)
        .set({ status: "ready", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(orders.id, task.orderId), eq(orders.companyId, dbUser.companyId!)));
      revalidatePath(`/orders/${task.orderId}`);
    }
  }

  revalidatePath("/production");
  revalidatePath("/orders");
}
