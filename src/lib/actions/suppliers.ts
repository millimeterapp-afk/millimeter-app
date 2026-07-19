"use server";

import { db } from "@/lib/db";
import {
  suppliers, supplierInvoices, supplierInvoiceItems,
  invoiceAdditionalCosts, materials, inventoryItems,
} from "@/lib/db/schema";

import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
  return { user, dbUser };
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export async function getSuppliers() {
  const { dbUser } = await getCurrentUser();
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.companyId, dbUser.companyId!))
    .orderBy(suppliers.name);
}

export async function createSupplier(data: {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  taxId?: string;
  notes?: string;
}) {
  const { dbUser } = await getCurrentUser();

  const [supplier] = await db
    .insert(suppliers)
    .values({
      companyId: dbUser.companyId!,
      name: data.name,
      contactPerson: data.contactPerson || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      country: data.country || null,
      taxId: data.taxId || null,
      notes: data.notes || null,
    })
    .returning();

  revalidatePath("/suppliers");
  return supplier;
}

export async function updateSupplier(id: string, data: {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  taxId?: string;
  notes?: string;
}) {
  const { dbUser } = await getCurrentUser();

  await db
    .update(suppliers)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.country !== undefined && { country: data.country || null }),
      ...(data.taxId !== undefined && { taxId: data.taxId || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    })
    .where(and(eq(suppliers.id, id), eq(suppliers.companyId, dbUser.companyId!)));

  revalidatePath("/suppliers");
}

// ─── Supplier Invoices ────────────────────────────────────────────────────────

export async function getSupplierInvoices() {
  const { dbUser } = await getCurrentUser();
  return db.query.supplierInvoices.findMany({
    where: (si, { eq }) => eq(si.companyId, dbUser.companyId!),
    with: {
      supplier: true,
      items: {
        with: { material: true, inventoryItem: true },
      },
      additionalCosts: true,
    },
    orderBy: (si, { desc }) => [desc(si.createdAt)],
  });
}

export async function getSupplierInvoice(id: string) {
  const { dbUser } = await getCurrentUser();
  return db.query.supplierInvoices.findFirst({
    where: (si, { eq, and }) =>
      and(eq(si.id, id), eq(si.companyId, dbUser.companyId!)),
    with: {
      supplier: true,
      items: {
        with: { material: true, inventoryItem: true },
      },
      additionalCosts: true,
    },
  });
}

export type InvoiceItemInput = {
  description: string;
  materialId?: string;
  inventoryItemId?: string;
  quantity: number;
  unitPrice: number;
};

export type AdditionalCostInput = {
  costType: string;
  description?: string;
  amount: number;
  customsDutyRate?: number;
};

export async function createSupplierInvoice(data: {
  supplierId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency?: string;
  exchangeRate?: number;
  notes?: string;
  items: InvoiceItemInput[];
  additionalCosts: AdditionalCostInput[];
}) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;

  // — Validacija —
  if (!data.invoiceNumber || !data.invoiceNumber.trim()) throw new Error("Broj fakture je obavezan.");
  for (const it of data.items) {
    if (!Number.isFinite(it.quantity) || it.quantity <= 0) throw new Error("Količina stavke mora biti > 0.");
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) throw new Error("Cena stavke mora biti ≥ 0.");
  }
  for (const c of data.additionalCosts) {
    if (c.amount != null && (!Number.isFinite(c.amount) || c.amount < 0)) throw new Error("Dodatni trošak mora biti ≥ 0.");
  }
  // Dobavljač i svi materijali/artikli moraju pripadati firmi (cross-tenant zaštita)
  if (data.supplierId) {
    const sup = await db.query.suppliers.findFirst({
      where: (s, { eq, and }) => and(eq(s.id, data.supplierId!), eq(s.companyId, companyId)),
    });
    if (!sup) throw new Error("Dobavljač nije pronađen.");
  }
  for (const it of data.items) {
    if (it.materialId) {
      const m = await db.query.materials.findFirst({
        where: (m, { eq, and }) => and(eq(m.id, it.materialId!), eq(m.companyId, companyId)),
      });
      if (!m) throw new Error("Materijal iz stavke nije pronađen.");
    }
    if (it.inventoryItemId) {
      const inv = await db.query.inventoryItems.findFirst({
        where: (i, { eq, and }) => and(eq(i.id, it.inventoryItemId!), eq(i.companyId, companyId)),
      });
      if (!inv) throw new Error("Artikal iz stavke nije pronađen.");
    }
  }

  // Izračunaj subtotal
  const subtotal = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // Izračunaj ukupne dodatne troškove
  const totalAdditional = data.additionalCosts.reduce((sum, c) => {
    if (c.costType === "customs_duty" && c.customsDutyRate) {
      // Carina = stopa% od subtotal
      return sum + (subtotal * c.customsDutyRate) / 100;
    }
    return sum + c.amount;
  }, 0);

  const totalAmount = subtotal + totalAdditional;

  const [invoice] = await db
    .insert(supplierInvoices)
    .values({
      companyId: dbUser.companyId!,
      supplierId: data.supplierId || null,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      currency: data.currency || "EUR",
      exchangeRate: String(data.exchangeRate ?? 1),
      subtotal: String(subtotal),
      totalAdditionalCosts: String(totalAdditional),
      totalAmount: String(totalAmount),
      status: "draft",
      notes: data.notes || null,
      createdBy: user.id,
    })
    .returning();

  // Dodaj stavke i alociraj troškove proporcionalno
  if (data.items.length > 0) {
    const itemsWithTotal = data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    await db.insert(supplierInvoiceItems).values(
      itemsWithTotal.map((item) => {
        const proportion = subtotal > 0 ? item.total / subtotal : 0;
        const allocated = totalAdditional * proportion;
        const finalUnitCost = item.quantity > 0
          ? (item.total + allocated) / item.quantity
          : item.unitPrice;

        return {
          invoiceId: invoice.id,
          materialId: item.materialId || null,
          inventoryItemId: item.inventoryItemId || null,
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          totalPrice: String(item.total),
          allocatedAdditionalCost: String(allocated),
          finalUnitCost: String(finalUnitCost),
        };
      })
    );

    // Ažuriraj lastPurchasePrice za materijale
    for (const item of itemsWithTotal) {
      if (item.materialId) {
        const proportion = subtotal > 0 ? item.total / subtotal : 0;
        const allocated = totalAdditional * proportion;
        const finalUnitCost = item.quantity > 0
          ? (item.total + allocated) / item.quantity
          : item.unitPrice;

        await db.update(materials)
          .set({ lastPurchasePrice: String(finalUnitCost) })
          .where(and(eq(materials.id, item.materialId), eq(materials.companyId, companyId)));
      }
      if (item.inventoryItemId) {
        const proportion = subtotal > 0 ? item.total / subtotal : 0;
        const allocated = totalAdditional * proportion;
        const finalUnitCost = item.quantity > 0
          ? (item.total + allocated) / item.quantity
          : item.unitPrice;

        await db.update(inventoryItems)
          .set({ costPrice: String(finalUnitCost) })
          .where(and(eq(inventoryItems.id, item.inventoryItemId), eq(inventoryItems.companyId, companyId)));
      }
    }
  }

  // Dodaj dodatne troškove
  if (data.additionalCosts.length > 0) {
    await db.insert(invoiceAdditionalCosts).values(
      data.additionalCosts.map((cost) => ({
        invoiceId: invoice.id,
        costType: cost.costType,
        description: cost.description || null,
        amount: cost.costType === "customs_duty" && cost.customsDutyRate
          ? String((subtotal * cost.customsDutyRate) / 100)
          : String(cost.amount),
        customsDutyRate: cost.customsDutyRate ? String(cost.customsDutyRate) : null,
      }))
    );
  }

  revalidatePath("/suppliers");
  return invoice;
}

export async function postInvoice(id: string) {
  const { dbUser } = await getCurrentUser();

  // Dohvati fakturu sa stavkama
  const invoice = await db.query.supplierInvoices.findFirst({
    where: (si, { eq, and }) =>
      and(eq(si.id, id), eq(si.companyId, dbUser.companyId!)),
    with: { items: true },
  });

  if (!invoice) throw new Error("Faktura nije pronađena");
  if (invoice.status === "posted") throw new Error("Faktura je već knjižena");

  // Povećaj stanje zaliha za svaku stavku
  for (const item of invoice.items) {
    const qty = Number(item.quantity);
    if (item.materialId) {
      await db.update(materials)
        .set({ currentStock: sql`current_stock + ${qty}`, updatedAt: new Date() })
        .where(eq(materials.id, item.materialId));
    }
    if (item.inventoryItemId) {
      await db.update(inventoryItems)
        .set({ quantity: sql`quantity + ${qty}` })
        .where(eq(inventoryItems.id, item.inventoryItemId));
    }
  }

  await db.update(supplierInvoices)
    .set({ status: "posted" })
    .where(and(eq(supplierInvoices.id, id), eq(supplierInvoices.companyId, dbUser.companyId!)));

  revalidatePath("/suppliers");
}
