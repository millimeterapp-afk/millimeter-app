import { getCustomers } from "@/lib/actions/customers";
import { getInventoryItems } from "@/lib/actions/inventory";
import { getSales } from "@/lib/actions/sales";
import { SalesClient } from "./sales-client";

export default async function SalesPage() {
  const [customers, inventoryItems, recentSales] = await Promise.all([
    getCustomers(),
    getInventoryItems(),
    getSales(),
  ]);

  return (
    <SalesClient
      customers={customers}
      inventoryItems={inventoryItems}
      recentSales={recentSales}
    />
  );
}
