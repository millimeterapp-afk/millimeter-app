import { getMaterials, getInventoryItems } from "@/lib/actions/inventory";
import { BarcodesClient } from "./barcodes-client";
import { guardSection } from "@/lib/access-guard";

export default async function BarcodesPage() {
  await guardSection("/barcodes");
  const [mats, items] = await Promise.all([getMaterials(), getInventoryItems()]);
  return <BarcodesClient materials={mats} inventoryItems={items} />;
}
