import { getSales } from "@/lib/actions/sales";
import { SalesClient } from "./sales-client";

export default async function SalesPage() {
  // Klijent i artikal se biraju serverskom pretragom (CustomerPicker / searchInventoryLite)
  // — pun spisak (klijenti, 1607 artikala) se NE šalje u browser.
  const recentSales = await getSales();
  return <SalesClient recentSales={recentSales} />;
}
