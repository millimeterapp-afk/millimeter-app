import { getSales } from "@/lib/actions/sales";
import { SalesClient } from "./sales-client";
import { guardSection } from "@/lib/access-guard";

export default async function SalesPage() {
  await guardSection("/sales");
  // Klijent i artikal se biraju serverskom pretragom (CustomerPicker / searchInventoryLite)
  // — pun spisak (klijenti, 1607 artikala) se NE šalje u browser.
  const recentSales = await getSales();
  return <SalesClient recentSales={recentSales} />;
}
