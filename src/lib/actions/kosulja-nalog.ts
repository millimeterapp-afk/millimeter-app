"use server";

import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { withTxRetry } from "@/lib/db-retry";

// Nalog za KOŠULJU (domaća proizvodnja). Kreira order (orderKind "domaca") + jednu
// stavku, sa svim izborima i snapshotom mera u jsonb-u. Ide u Naloge/Produkciju kao i
// ostala domaća proizvodnja. Konačan izračun (bazne + korekcije) je stvar prikaza —
// ovde čuvamo SIROVO (bazne mere + delte), pa je bezbedno bez obzira na tumačenje ½.
export async function createKosuljaNalog(data: {
  customerId: string;
  kroj: string;          // npr. "Hol slim"
  velicina: string;      // npr. "42"
  kragna: string;
  stej: string;
  spic: string;
  manzetna: string;
  materijal?: string;
  cena?: number;
  korekcije: Record<string, number>;                       // delte po meri
  bazneMere?: { letter: string; sr: string; vrednost: number; obim: number }[] | null;
  mereSaStrane?: { key: string; label: string; base: number | null; delta: number; konacno: number | null }[] | null; // bazne + korekcije
  monogram?: { tekst: string; mesto: string; boja: string; font: string };
  napomena?: string;
  idempotencyKey?: string;
}) {
  const { user, dbUser } = await requireActiveUser();
  const companyId = dbUser.companyId!;

  if (!data.customerId) throw new Error("Klijent je obavezan.");
  if (!data.velicina) throw new Error("Veličina je obavezna.");
  if (!data.kragna) throw new Error("Kragna je obavezna.");
  if (!data.manzetna) throw new Error("Manžetna je obavezna.");
  const cena = Number(data.cena ?? 0);
  if (!Number.isFinite(cena) || cena < 0) throw new Error("Cena mora biti broj ≥ 0.");

  const naziv = `Košulja ${data.kroj} ${data.velicina}`.trim();
  const sablon = `${data.kroj} ${data.velicina}`.trim();
  const due = new Date();
  due.setDate(due.getDate() + 15); // rok domaće proizvodnje ~10–15 radnih dana
  const dueDate = due.toISOString().split("T")[0];

  const snapshot = {
    kroj: data.kroj, velicina: data.velicina, kragna: data.kragna,
    stej: data.stej, spic: data.spic, manzetna: data.manzetna,
    materijal: data.materijal || null, korekcije: data.korekcije,
    bazneMere: data.bazneMere ?? null, mereSaStrane: data.mereSaStrane ?? null,
  };

  let noviId = "";
  await withTxRetry(() => db.transaction(async (tx) => {
    // Klijent mora pripadati firmi i ne sme biti obrisan (zaključan da ga merge ne dira usput)
    const cust = (await tx.execute(sql`
      SELECT id FROM customers WHERE id = ${data.customerId} AND company_id = ${companyId} AND deleted_at IS NULL FOR KEY SHARE
    `)) as unknown as { id: string }[];
    if (!cust[0]) throw new Error("Klijent nije pronađen.");

    // Idempotency — isti formular (dvoklik/retry/dva taba) ne pravi dupli nalog
    if (data.idempotencyKey) {
      const dup = (await tx.execute(sql`
        SELECT id FROM orders WHERE company_id = ${companyId} AND idempotency_key = ${data.idempotencyKey} LIMIT 1
      `)) as unknown as { id: string }[];
      if (dup[0]) { noviId = dup[0].id; return; }
    }

    const cnt = (await tx.execute(sql`SELECT count(*)::int AS c FROM orders WHERE company_id = ${companyId}`)) as unknown as { c: number }[];
    const orderNumber = `KOS-${new Date().getFullYear()}-${String(Number(cnt[0].c) + 1).padStart(4, "0")}`;

    const [ord] = await tx.insert(orders).values({
      companyId,
      orderNumber,
      customerId: data.customerId,
      orderKind: "domaca",
      orderType: "custom",
      nalogStatus: "naruceno",
      productionFlow: "millimeter",
      createdBy: user.id,
      dueDate,
      totalAmount: String(cena),
      paidAmount: "0",
      paymentStatus: "unpaid",
      item: naziv,
      material: data.materijal || null,
      templateNumber: sablon,
      collarType: data.kragna,
      fitType: sablon,
      measurementSnapshot: snapshot,
      notes: data.napomena || null,
      idempotencyKey: data.idempotencyKey ?? null,
    }).returning({ id: orders.id });

    await tx.insert(orderItems).values({
      orderId: ord.id,
      artikal: naziv,
      quantity: 1,
      unitPrice: String(cena),
      totalPrice: String(cena),
      material: data.materijal || null,
      templateNumber: sablon,
      collarType: data.kragna,
      cuffType: data.manzetna,
      fitType: sablon,
      measurementSnapshot: { korekcije: data.korekcije, bazneMere: data.bazneMere ?? null, mereSaStrane: data.mereSaStrane ?? null, stej: data.stej, spic: data.spic },
      monogramData: data.monogram
        ? { tekst: data.monogram.tekst, pozicija: data.monogram.mesto, boja: data.monogram.boja, font: data.monogram.font }
        : null,
    });

    noviId = ord.id;
  }));

  revalidatePath("/orders");
  revalidatePath("/production");
  revalidatePath("/nalog-kosulja");
  return { id: noviId };
}
