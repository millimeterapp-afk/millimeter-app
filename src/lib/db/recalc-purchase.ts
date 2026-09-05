import { sql } from "drizzle-orm";

// Izdvojeno iz purchases.ts (koje ima "use server") jer Next.js zahteva da SVAKI
// eksport iz "use server" fajla bude async Server Action — ovo je čist SQL-fragment
// helper, ne akcija, pa mora biti u običnom modulu (build je pukao dok je bio tamo).
//
// Ukupno = zbir naloga koji NISU otkazani. Ponovo izračuna i status plaćanja.
// Jedna atomarna izjava — koristi se u više akcija (otkazivanje naloga, izmjena stavki).
export const recalcPurchaseTotalsSql = (purchaseId: string, companyId: string) => sql`
  WITH t AS (
    SELECT COALESCE(SUM(total_amount), 0) AS total
    FROM orders WHERE purchase_id = ${purchaseId} AND company_id = ${companyId} AND nalog_status <> 'otkazano'
  )
  UPDATE purchases p
  SET total_amount = t.total,
      payment_status = CASE
        WHEN p.paid_amount >= t.total AND t.total > 0 THEN 'paid'
        WHEN p.paid_amount > 0 THEN 'avans'
        ELSE 'unpaid' END,
      updated_at = now()
  FROM t
  WHERE p.id = ${purchaseId} AND p.company_id = ${companyId}
`;
