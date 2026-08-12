"use server";

import { db } from "@/lib/db";
import { materials, inventoryItems, inventoryMovements } from "@/lib/db/schema";

import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import * as XLSX from "xlsx";

async function getCurrentUser() {
  const { user, dbUser } = await requireActiveUser();
  return { user, dbUser };
}

// Pretraga artikala/materijala PO RIJEČIMA: svaka riječ upita mora da se nađe u nekom polju
// (naziv/šifra/kategorija). Time "Falke 2000" pogađa "Falke 10305 2000", a "Carpi 70"
// pogađa "Carpi 400/70" (Aleksandrov komentar — redoslijed riječi nije bitan).
function buildInventorySearch(q: string) {
  const tokens = q.split(/\s+/).filter(Boolean);
  return and(
    ...tokens.map((t) => or(
      ilike(inventoryItems.name, `%${t}%`),
      ilike(inventoryItems.sku, `%${t}%`),
      ilike(inventoryItems.category, `%${t}%`)
    )!)
  );
}

export async function getMaterials() {
  const { dbUser } = await getCurrentUser();

  return db
    .select()
    .from(materials)
    .where(eq(materials.companyId, dbUser.companyId!))
    .orderBy(desc(materials.createdAt));
}

export async function createMaterial(data: {
  name: string;
  code?: string;
  category?: string;
  unit: string;
  currentStock: number;
  lastPurchasePrice?: number;
  reorderLevel?: number;
}) {
  const { dbUser } = await getCurrentUser();

  const [material] = await db
    .insert(materials)
    .values({
      companyId: dbUser.companyId!,
      name: data.name,
      code: data.code || null,
      category: data.category || null,
      unit: data.unit || "m",
      currentStock: String(data.currentStock),
      reservedStock: "0",
      lastPurchasePrice: data.lastPurchasePrice ? String(data.lastPurchasePrice) : null,
      reorderLevel: data.reorderLevel != null ? String(data.reorderLevel) : "5",
    })
    .returning();

  revalidatePath("/inventory");
  return material;
}

export async function updateInventoryItem(
  id: string,
  data: {
    name?: string;
    sku?: string;
    category?: string;
    salePrice?: number | null;
    costPrice?: number | null;
  }
) {
  const { dbUser } = await getCurrentUser();

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.sku !== undefined) updates.sku = data.sku || null;
  if (data.category !== undefined) updates.category = data.category || null;
  if (data.salePrice !== undefined) updates.salePrice = data.salePrice != null ? String(data.salePrice) : null;
  if (data.costPrice !== undefined) updates.costPrice = data.costPrice != null ? String(data.costPrice) : null;

  await db
    .update(inventoryItems)
    .set(updates)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.companyId, dbUser.companyId!)));

  revalidatePath("/inventory");
}

export async function updateMaterial(
  id: string,
  data: {
    name?: string;
    code?: string;
    category?: string;
    unit?: string;
    lastPurchasePrice?: number | null;
    reorderLevel?: number | null;
  }
) {
  const { dbUser } = await getCurrentUser();

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.code !== undefined) updates.code = data.code || null;
  if (data.category !== undefined) updates.category = data.category || null;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.lastPurchasePrice !== undefined) updates.lastPurchasePrice = data.lastPurchasePrice != null ? String(data.lastPurchasePrice) : null;
  if (data.reorderLevel !== undefined) updates.reorderLevel = data.reorderLevel != null ? String(data.reorderLevel) : null;
  updates.updatedAt = new Date();

  await db
    .update(materials)
    .set(updates)
    .where(and(eq(materials.id, id), eq(materials.companyId, dbUser.companyId!)));

  revalidatePath("/inventory");
}

export async function getInventoryItems() {
  const { dbUser } = await getCurrentUser();

  return db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.companyId, dbUser.companyId!))
    .orderBy(desc(inventoryItems.createdAt));
}

// Server-pretraga za biranje artikla u prodaji — vraća samo robu NA STANJU koja
// odgovara upitu (do 30). Katalog (1607, stanje 0) se ne vuče ceo u browser.
export async function searchInventoryLite(query: string) {
  const { dbUser } = await getCurrentUser();
  const q = (query || "").trim();
  if (q.length < 1) return [];
  return db
    .select()
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.companyId, dbUser.companyId!),
      sql`(quantity - reserved_quantity) > 0`,
      buildInventorySearch(q)
    ))
    .orderBy(inventoryItems.name)
    .limit(30);
}

// Agregati za /inventory kartice (ukupan broj + vrijednost) — bez učitavanja svih
export async function getInventoryStats() {
  const { dbUser } = await getCurrentUser();
  const [r] = await db.select({
    count: sql<number>`count(*)`,
    value: sql<number>`coalesce(sum(quantity * coalesce(sale_price, 0)), 0)`,
  }).from(inventoryItems).where(eq(inventoryItems.companyId, dbUser.companyId!));
  return { itemCount: Number(r.count), itemStockValue: Number(r.value) };
}

// Pretraga MATERIJALA (za domaću proizvodnju / nalog za košulju) — po riječima, do 30.
// Aleksandrov komentar #2: polje materijala u nalogu treba da nudi materijale iz baze.
export async function searchMaterials(query: string) {
  const { dbUser } = await getCurrentUser();
  const q = (query || "").trim();
  if (q.length < 1) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return db
    .select({ id: materials.id, name: materials.name, code: materials.code, category: materials.category })
    .from(materials)
    .where(and(
      eq(materials.companyId, dbUser.companyId!),
      ...tokens.map((t) => or(
        ilike(materials.name, `%${t}%`),
        ilike(materials.code, `%${t}%`),
        ilike(materials.category, `%${t}%`)
      )!)
    ))
    .orderBy(materials.name)
    .limit(30);
}

// Pretraga KATALOGA za nalog gotovog proizvoda — vraća artikle bez obzira na stanje
// (za razliku od searchInventoryLite koji traži samo robu na stanju za POS).
export async function searchCatalog(query: string) {
  const { dbUser } = await getCurrentUser();
  const q = (query || "").trim();
  if (q.length < 1) return [];
  return db
    .select({
      id: inventoryItems.id, name: inventoryItems.name, sku: inventoryItems.sku,
      category: inventoryItems.category, salePrice: inventoryItems.salePrice,
    })
    .from(inventoryItems)
    .where(and(
      eq(inventoryItems.companyId, dbUser.companyId!),
      buildInventorySearch(q)
    ))
    .orderBy(inventoryItems.name)
    .limit(30);
}

// Paginirana lista gotove robe za /inventory (umjesto svih 1607 odjednom)
export async function getInventoryItemsPage(search: string, page = 1, pageSize = 30) {
  const { dbUser } = await getCurrentUser();
  const conds = [eq(inventoryItems.companyId, dbUser.companyId!)];
  const q = (search || "").trim();
  if (q) {
    conds.push(buildInventorySearch(q)!);
  }
  const size = Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 30));
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const [rows, cnt] = await Promise.all([
    db.select().from(inventoryItems).where(and(...conds))
      // stabilan tie-breaker (name, id) — bez njega isti nazivi mogu da se dupliraju/preskoče na granici strane
      .orderBy(inventoryItems.name, inventoryItems.id).limit(size).offset((safePage - 1) * size),
    db.select({ count: sql<number>`count(*)` }).from(inventoryItems).where(and(...conds)),
  ]);
  return { items: rows, total: Number(cnt[0].count), page: safePage };
}

export async function createInventoryItem(data: {
  name: string;
  sku?: string;
  category?: string;
  quantity: number;
  salePrice?: number;
  costPrice?: number;
}) {
  const { dbUser } = await getCurrentUser();

  const [item] = await db
    .insert(inventoryItems)
    .values({
      companyId: dbUser.companyId!,
      name: data.name,
      sku: data.sku || null,
      category: data.category || null,
      quantity: data.quantity,
      reservedQuantity: 0,
      salePrice: data.salePrice ? String(data.salePrice) : null,
      costPrice: data.costPrice ? String(data.costPrice) : null,
    })
    .returning();

  revalidatePath("/inventory");
  return item;
}

export async function receiveMaterial(
  materialId: string,
  quantity: number,
  note?: string
) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Količina prijema mora biti broj > 0.");

  // Stanje + log u JEDNOJ transakciji (nema stanja bez loga, ni obrnuto)
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(materials)
      .set({ currentStock: sql`current_stock + ${quantity}`, updatedAt: new Date() })
      .where(and(eq(materials.id, materialId), eq(materials.companyId, companyId)))
      .returning({ id: materials.id });
    if (updated.length === 0) throw new Error("Materijal nije pronađen.");

    await tx.insert(inventoryMovements).values({
      companyId,
      itemType: "material",
      itemId: materialId,
      movementType: "receive",
      quantity: String(quantity),
      notes: note || null,
      createdBy: user.id,
    });
  });

  revalidatePath("/inventory");
}

export async function receiveInventoryItem(
  itemId: string,
  quantity: number,
  note?: string
) {
  const { user, dbUser } = await getCurrentUser();
  const companyId = dbUser.companyId!;
  // Zaliha gotovih artikala je cjelobrojna (integer kolona) — prijem mora biti cio broj
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Količina prijema mora biti cio broj > 0.");

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(inventoryItems)
      .set({ quantity: sql`quantity + ${quantity}` })
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.companyId, companyId)))
      .returning({ id: inventoryItems.id });
    if (updated.length === 0) throw new Error("Artikal nije pronađen.");

    await tx.insert(inventoryMovements).values({
      companyId,
      itemType: "inventory_item",
      itemId,
      movementType: "receive",
      quantity: String(quantity),
      notes: note || null,
      createdBy: user.id,
    });
  });

  revalidatePath("/inventory");
}

function generateBarcodeString(prefix: string, id: string): string {
  // MM-MAT-XXXX ili MM-INV-XXXX — koristi zadnjih 8 znakova UUID-a
  return `${prefix}-${id.replace(/-/g, "").slice(-8).toUpperCase()}`;
}

export async function generateMaterialBarcode(materialId: string) {
  const { dbUser } = await getCurrentUser();

  const mat = await db.query.materials.findFirst({
    where: (m, { eq, and }) =>
      and(eq(m.id, materialId), eq(m.companyId, dbUser.companyId!)),
  });
  if (!mat) throw new Error("Materijal nije pronađen");
  if (mat.barcode) return mat.barcode;

  const barcode = generateBarcodeString("MM-MAT", materialId);
  await db.update(materials)
    .set({ barcode })
    .where(eq(materials.id, materialId));

  revalidatePath("/inventory");
  return barcode;
}

export async function generateInventoryItemBarcode(itemId: string) {
  const { dbUser } = await getCurrentUser();

  const item = await db.query.inventoryItems.findFirst({
    where: (i, { eq, and }) =>
      and(eq(i.id, itemId), eq(i.companyId, dbUser.companyId!)),
  });
  if (!item) throw new Error("Artikal nije pronađen");
  if (item.barcode) return item.barcode;

  const barcode = generateBarcodeString("MM-INV", itemId);
  await db.update(inventoryItems)
    .set({ barcode })
    .where(eq(inventoryItems.id, itemId));

  revalidatePath("/inventory");
  return barcode;
}

export async function lookupByBarcode(barcode: string) {
  const { dbUser } = await getCurrentUser();

  const mat = await db.query.materials.findFirst({
    where: (m, { eq, and }) =>
      and(eq(m.barcode, barcode), eq(m.companyId, dbUser.companyId!)),
  });
  if (mat) return { type: "material" as const, item: mat };

  const inv = await db.query.inventoryItems.findFirst({
    where: (i, { eq, and }) =>
      and(eq(i.barcode, barcode), eq(i.companyId, dbUser.companyId!)),
  });
  if (inv) return { type: "inventory_item" as const, item: inv };

  return null;
}

export async function getInventoryMovements() {
  const { dbUser } = await getCurrentUser();

  return db
    .select()
    .from(inventoryMovements)
    .where(eq(inventoryMovements.companyId, dbUser.companyId!))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(100);
}

export async function importMaterials(formData: FormData) {
  const { dbUser } = await getCurrentUser();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Fajl nije pronađen");

  const buffer = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const toInsert = rows
    .filter((row) => row["Naziv"])
    .map((row) => {
      const jm = String(row["JM"] ?? "").toUpperCase();
      const unit = jm === "KOM" ? "kom" : jm === "KG" ? "kg" : "m";
      const rawPrice = Number(row["Nab. cena sa PDV"] ?? row["Nab.cena sa PDV"] ?? 0);
      return {
        companyId: dbUser.companyId!,
        name: String(row["Naziv"]),
        code: row["Šifra"] ? String(row["Šifra"]) : null,
        barcode: row["Barkod"] ? String(row["Barkod"]) : null,
        category: row["Grupa"] ? String(row["Grupa"]) : null,
        unit,
        currentStock: "0",
        reservedStock: "0",
        lastPurchasePrice: rawPrice > 0 ? String(rawPrice) : null,
        reorderLevel: "5",
      };
    });

  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await db.insert(materials).values(toInsert.slice(i, i + CHUNK));
  }

  revalidatePath("/inventory");
  return { inserted: toInsert.length, total: rows.length };
}

export async function importInventoryItems(formData: FormData) {
  const { dbUser } = await getCurrentUser();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Fajl nije pronađen");

  const buffer = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  const toInsert = rows
    .filter((row) => row["Naziv"])
    .map((row) => {
      const rawPrice = Number(row["Cena"] ?? 0);
      return {
        companyId: dbUser.companyId!,
        name: String(row["Naziv"]),
        sku: row["Šifra"] ? String(row["Šifra"]) : null,
        category: row["Grupa"] ? String(row["Grupa"]) : null,
        quantity: 0,
        reservedQuantity: 0,
        salePrice: rawPrice > 0 ? String(rawPrice) : null,
        costPrice: null,
      };
    });

  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await db.insert(inventoryItems).values(toInsert.slice(i, i + CHUNK));
  }

  revalidatePath("/inventory");
  return { inserted: toInsert.length, total: rows.length };
}
