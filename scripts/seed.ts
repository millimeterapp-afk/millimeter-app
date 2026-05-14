/**
 * Seed skriptu pokrenuti JEDNOM da se popuni baza.
 * Pokretanje: npx tsx scripts/seed.ts
 *
 * Pre pokretanja:
 * 1. Popuni .env.local sa pravim ključevima
 * 2. Pokreni migracije: npx drizzle-kit push
 * 3. Kreiraj admina ručno u Supabase Auth (Authentication → Users → Add user)
 *    email: admin@millimeter.me
 *    password: izaberi lozinku
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function main() {
  console.log("🌱 Seeding...");

  // 1. Kompanija
  const [company] = await db
    .insert(schema.companies)
    .values({
      name: "Millimeter D.O.O.",
      country: "Montenegro",
      taxId: "02847361",
      address: "Podgorica, Crna Gora",
      currency: "EUR",
    })
    .returning();

  console.log("✅ Kompanija kreirana:", company.id);

  // 2. Materijali
  const materialData = [
    { name: "Bijela pamučna tkanina", code: "FAB-001", category: "Tkanina", unit: "m", currentStock: "45.5", lastPurchasePrice: "12.50" },
    { name: "Tamno plava vuna", code: "FAB-002", category: "Tkanina", unit: "m", currentStock: "30.0", lastPurchasePrice: "28.00" },
    { name: "Crni pamuk", code: "FAB-003", category: "Tkanina", unit: "m", currentStock: "22.0", lastPurchasePrice: "10.00" },
    { name: "Postava bijela", code: "LIN-001", category: "Postava", unit: "m", currentStock: "60.0", lastPurchasePrice: "4.50" },
    { name: "Dugmad bijela 1cm", code: "BUT-001", category: "Pribor", unit: "kom", currentStock: "500", lastPurchasePrice: "0.15" },
    { name: "Konac bijeli", code: "THR-001", category: "Pribor", unit: "kom", currentStock: "50", lastPurchasePrice: "1.20" },
  ];

  await db.insert(schema.materials).values(
    materialData.map((m) => ({ ...m, companyId: company.id, reservedStock: "0" }))
  );

  console.log("✅ Materijali kreirani");
  console.log("\n✅ Seed završen!");
  console.log("\n📋 Sledeći korak:");
  console.log("   1. Idi na Supabase → Authentication → Users");
  console.log("   2. Klikni 'Add user' → Create new user");
  console.log("   3. Email: admin@millimeter.me, izaberi lozinku");
  console.log("   4. Kopiraj UUID korisnika");
  console.log("   5. Pokreni: INSERT INTO users (id, email, full_name, role, company_id)");
  console.log(`      VALUES ('<UUID>', 'admin@millimeter.me', 'Admin', 'owner', '${company.id}');`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
