import { getInventoryItems } from "@/lib/actions/inventory";
import { getSales } from "@/lib/actions/sales";
import { SalesClient } from "./sales-client";

export default async function SalesPage() {
  // Klijent se bira serverskom pretragom (CustomerPicker) — pun spisak se ne šalje
  const [inventoryItems, recentSales] = await Promise.all([
    getInventoryItems(),
    getSales(),
  ]);

  return (
    <SalesClient
      inventoryItems={inventoryItems}
      recentSales={recentSales}
    />
  );
}
