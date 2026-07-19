"use server";

import { db } from "@/lib/db";
import { orders, materialReservations, productionTasks, materials, customers, customerMeasurements } from "@/lib/db/schema";
import { syncCustomerToGoCreate } from "@/lib/actions/customers";
import { applyLoyaltyTier } from "@/lib/loyalty";
import { requireActiveUser } from "@/lib/auth";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { belgradeToday } from "@/lib/datetime";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
  return { user, dbUser };
}

export async function getOrders(statusFilter?: string) {
  const { dbUser } = await getCurrentUser();

  const conditions = [eq(orders.companyId, dbUser.companyId!)];
  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(orders.status, statusFilter as "draft" | "confirmed" | "in_production" | "ready" | "delivered" | "cancelled"));
  }

  return db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt));
}

export async function getOrder(id: string) {
  const { dbUser } = await getCurrentUser();

  return db.query.orders.findFirst({
    where: (o, { eq, and }) =>
      and(eq(o.id, id), eq(o.companyId, dbUser.companyId!)),
    with: {
      customer: {
        with: {
          measurements: {
            where: (m, { eq }) => eq(m.isActive, true),
            limit: 1,
          },
        },
      },
      items: true,
      purchase: true,
      corrections: {
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      },
    },
  });
}

async function generateOrderNumber(companyId: string): Promise<string> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.companyId, companyId));

  const count = Number(result[0].count) + 1;
  const year = new Date().getFullYear();
  return `NAL-${year}-${String(count).padStart(4, "0")}`;
}

export async function createOrder(data: {
  customerId: string;
  orderType: "custom" | "ready_made" | "correction";
  productionFlow?: "millimeter" | "munro";
  dueDate?: string;
  totalAmount: number;
  notes?: string;
  item?: string;
  material?: string;
  templateNumber?: string;
  collarType?: string;
  sleeveType?: string;
  fitType?: string;
  measurementSnapshot?: Record<string, unknown>;
}) {
  const { user, dbUser } = await getCurrentUser();

  const orderNumber = await generateOrderNumber(dbUser.companyId!);

  // Automatski kopiraj aktivna merenja klijenta ako nisu prosleđena
  let snapshot = data.measurementSnapshot;
  if (!snapshot && data.customerId) {
    const activeMeasurement = await db.query.customerMeasurements.findFirst({
      where: (m, { eq, and }) =>
        and(eq(m.customerId, data.customerId), eq(m.isActive, true)),
    });
    if (activeMeasurement?.data) {
      snapshot = activeMeasurement.data as Record<string, unknown>;
    }
  }

  const [order] = await db
    .insert(orders)
    .values({
      companyId: dbUser.companyId!,
      orderNumber,
      customerId: data.customerId,
      orderType: data.orderType,
      status: "draft",
      createdBy: user.id,
      dueDate: data.dueDate || null,
      totalAmount: String(data.totalAmount),
      notes: data.notes || null,
      productionFlow: data.productionFlow ?? "millimeter",
      item: data.item || null,
      material: data.material || null,
      templateNumber: data.templateNumber || null,
      collarType: data.collarType || null,
      sleeveType: data.sleeveType || null,
      fitType: data.fitType || null,
      measurementSnapshot: snapshot || null,
    })
    .returning();

  // Za Munro naloge — sinhronizuj klijenta u GoCreate u pozadini
  // Ne blokira kreiranje naloga ako GoCreate API nije dostupan
  if (data.productionFlow === "munro" && data.customerId) {
    syncCustomerToGoCreate(data.customerId).then((result) => {
      if (!result.ok) console.error("[GoCreate] auto-sync failed:", result.error);
    });
  }

  revalidatePath("/orders");
  return order;
}

export async function updateOrderStatus(
  id: string,
  status: "draft" | "confirmed" | "in_production" | "ready" | "delivered" | "cancelled",
  options?: { materialQuantity?: number }
) {
  const { dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // Nalog MORA pripadati firmi — i provjera mora biti PRIJE svega ostalog.
  // Bez ovoga bi UUID tuđeg naloga prošao prvi (scoped) UPDATE bez efekta,
  // a ostatak funkcije bi dirao tuđe rezervacije/zalihe/klijente.
  const order = await db.query.orders.findFirst({
    where: (o, { eq, and }) => and(eq(o.id, id), eq(o.companyId, companyId)),
  });
  if (!order) throw new Error("Nalog nije pronađen.");

  // Nalozi iz porudžbina se vode kroz novi tok (nalogStatus/updateNalogStatus).
  // Stari lifecycle bi DUPLO knjižio novac i posjete — zabranjeno server-side.
  if (order.purchaseId) {
    throw new Error("Ovaj nalog pripada porudžbini — koristi 'Fazu izrade', ne stari tok.");
  }

  const updates: Record<string, unknown> = { status, updatedAt: new Date() };

  if (status === "delivered") {
    updates.deliveredAt = new Date();
  }
  if (status === "ready") {
    updates.completedAt = new Date();
  }

  await db
    .update(orders)
    .set(updates)
    .where(and(eq(orders.id, id), eq(orders.companyId, companyId)));

  // Konzumiraj ili otpusti rezervaciju materijala
  if (status === "delivered" || status === "cancelled") {
    const reservation = await db.query.materialReservations.findFirst({
      where: (r, { eq }) => eq(r.orderId, id),
    });
    if (reservation && reservation.status === "reserved") {
      const qty = Number(reservation.quantityReserved);
      if (status === "delivered") {
        // Konzumiran — skini i sa currentStock i reservedStock
        await db.update(materials).set({
          currentStock: sql`current_stock - ${qty}`,
          reservedStock: sql`reserved_stock - ${qty}`,
        }).where(eq(materials.id, reservation.materialId));
        await db.update(materialReservations).set({ status: "consumed" })
          .where(eq(materialReservations.id, reservation.id));
      } else {
        // Otkazan — samo otpusti rezervaciju
        await db.update(materials).set({
          reservedStock: sql`reserved_stock - ${qty}`,
        }).where(eq(materials.id, reservation.materialId));
        await db.update(materialReservations).set({ status: "released" })
          .where(eq(materialReservations.id, reservation.id));
      }
    }
  }

  // Kad je isporučen — ažuriraj totalSpent i visitCount na klijentu
  // (order je već učitan i provjereno pripada firmi)
  if (status === "delivered") {
    if (order.customerId) {
      await db
        .update(customers)
        .set({
          totalSpent: sql`total_spent + ${Number(order.totalAmount)}`,
          visitCount: sql`visit_count + 1`,
          lastVisitDate: belgradeToday(),
          updatedAt: new Date(),
        })
        .where(and(eq(customers.id, order.customerId), eq(customers.companyId, companyId)));

      // Ažuriraj loyalty tier
      const updated = await db.query.customers.findFirst({
        where: (c, { eq, and }) => and(eq(c.id, order.customerId!), eq(c.companyId, companyId)),
      });
      if (updated) {
        await applyLoyaltyTier(order.customerId, Number(updated.totalSpent), companyId);
      }
    }
  }

  // Rezerviši materijal kad nalog postane potvrđen
  if (status === "confirmed") {
    if (order.material) {
      const mat = await db.query.materials.findFirst({
        where: (m, { eq, and }) =>
          and(eq(m.name, order.material!), eq(m.companyId, companyId)),
      });
      if (mat) {
        const existing = await db.query.materialReservations.findFirst({
          where: (r, { eq }) => eq(r.orderId, id),
        });
        if (!existing) {
          const reserveQty = options?.materialQuantity ?? 2;
          await db.insert(materialReservations).values({
            orderId: id,
            materialId: mat.id,
            quantityReserved: String(reserveQty),
            quantityUsed: "0",
            status: "reserved",
          });
          await db
            .update(materials)
            .set({ reservedStock: sql`reserved_stock + ${reserveQty}` })
            .where(eq(materials.id, mat.id));
        }
      }
    }
  }

  // Automatski kreiraj production task kad ide u produkciju
  if (status === "in_production") {
    const existing = await db.query.productionTasks.findFirst({
      where: (pt, { eq }) => eq(pt.orderId, id),
    });

    if (!existing) {
      await db.insert(productionTasks).values({
        companyId,
        orderId: id,
        status: "queued",
        priority: "medium",
        dueDate: order.dueDate || null,
        notesFromStore: order.notes || null,
      });
    }
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/production");
  if (status === "delivered") revalidatePath("/customers");
}

export async function updateOrderPayment(
  id: string,
  paidAmount: number,
  totalAmount: number
) {
  const { dbUser } = await getCurrentUser();

  const paymentStatus =
    paidAmount >= totalAmount
      ? "paid"
      : paidAmount > 0
      ? "partial"
      : "unpaid";

  await db
    .update(orders)
    .set({
      paidAmount: String(paidAmount),
      paymentStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.companyId, dbUser.companyId!)));

  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
}

export async function updateOrder(
  id: string,
  data: {
    item?: string;
    totalAmount?: number;
    dueDate?: string;
    notes?: string;
    collarType?: string;
    sleeveType?: string;
    fitType?: string;
    material?: string;
    productionFlow?: "millimeter" | "munro";
  }
) {
  const { dbUser } = await getCurrentUser();

  await db
    .update(orders)
    .set({
      ...( data.item !== undefined && { item: data.item }),
      ...( data.totalAmount !== undefined && { totalAmount: String(data.totalAmount) }),
      ...( data.dueDate !== undefined && { dueDate: data.dueDate || null }),
      ...( data.notes !== undefined && { notes: data.notes || null }),
      ...( data.collarType !== undefined && { collarType: data.collarType }),
      ...( data.sleeveType !== undefined && { sleeveType: data.sleeveType }),
      ...( data.fitType !== undefined && { fitType: data.fitType }),
      ...( data.material !== undefined && { material: data.material || null }),
      ...( data.productionFlow !== undefined && { productionFlow: data.productionFlow }),
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.companyId, dbUser.companyId!)));

  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
}
