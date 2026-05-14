import { getMaterials, getInventoryItems } from "@/lib/actions/inventory";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const [materials, inventoryItems] = await Promise.all([getMaterials(), getInventoryItems()]);
  return <InventoryClient materials={materials} inventoryItems={inventoryItems} />;
}
