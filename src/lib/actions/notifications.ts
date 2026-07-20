"use server";

import { db } from "@/lib/db";
import { orders, corrections, customers, materials } from "@/lib/db/schema";

import { eq, and, isNull, sql, notInArray, inArray } from "drizzle-orm";
import { requireActiveUser } from "@/lib/auth";
import { belgradeToday } from "@/lib/datetime";

async function getCompanyId() {
  try {
    const { companyId } = await requireActiveUser();
    return companyId;
  } catch {
    return null;
  }
}

const empty = { overdueOrders: [], openCorrections: [], inactiveCustomers: [], lowStockMaterials: [], materialReady: [] as { id: string; orderNumber: string; material: string }[] };

export async function getNotificationData() {
  try {
    const companyId = await getCompanyId();
    if (!companyId) return empty;

    const today = belgradeToday();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Sekvencijalno — ne paralelno — da ne zasipamo pool konekcijama
    const overdueOrders = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, item: orders.item, dueDate: orders.dueDate })
      .from(orders)
      .where(and(
        eq(orders.companyId, companyId),
        notInArray(orders.status, ["delivered", "cancelled"]),
        sql`${orders.dueDate} IS NOT NULL AND ${orders.dueDate} < ${today}`,
      ))
      .limit(10);

    const openCorrections = await db
      .select({ id: corrections.id, correctionType: corrections.correctionType, description: corrections.description })
      .from(corrections)
      .where(and(
        eq(corrections.companyId, companyId),
        inArray(corrections.status, ["open", "in_production"]),
      ))
      .limit(10);

    const inactiveCustomers = await db
      .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName, lastVisitDate: customers.lastVisitDate })
      .from(customers)
      .where(and(
        eq(customers.companyId, companyId),
        isNull(customers.deletedAt),
        sql`${customers.lastVisitDate} IS NOT NULL AND ${customers.lastVisitDate} < ${ninetyDaysAgo}`,
      ))
      .limit(3);

    const allMaterials = await db
      .select({ id: materials.id, name: materials.name, currentStock: materials.currentStock, reservedStock: materials.reservedStock, reorderLevel: materials.reorderLevel, unit: materials.unit })
      .from(materials)
      .where(eq(materials.companyId, companyId));

    const lowStockMaterials = allMaterials.filter((m) => {
      if (!m.reorderLevel) return false;
      return (Number(m.currentStock) - Number(m.reservedStock)) < Number(m.reorderLevel);
    });

    // Aleksandrov signal: nalozi u fazi "ceka_materijal" čiji je materijal sad na
    // stanju (stigla pošiljka pa unesen prijem). Znak da mogu u izradu.
    const materialReady = (await db.execute(sql`
      SELECT DISTINCT o.id, o.order_number AS "orderNumber", oi.material
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN materials m ON m.name = oi.material AND m.company_id = o.company_id
      WHERE o.company_id = ${companyId}
        AND o.nalog_status = 'ceka_materijal'
        AND (m.current_stock - m.reserved_stock) > 0
      LIMIT 15
    `)) as unknown as { id: string; orderNumber: string; material: string }[];

    return { overdueOrders, openCorrections, inactiveCustomers, lowStockMaterials, materialReady };
  } catch {
    return empty;
  }
}

export type NotificationData = Awaited<ReturnType<typeof getNotificationData>>;
