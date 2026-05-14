import { getMaterials, getInventoryItems } from "@/lib/actions/inventory";
import { BarcodesClient } from "./barcodes-client";

export default async function BarcodesPage() {
  const [mats, items] = await Promise.all([getMaterials(), getInventoryItems()]);
  return <BarcodesClient materials={mats} inventoryItems={items} />;
}
