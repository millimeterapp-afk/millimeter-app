import { Suspense } from "react";
import { getMaterials, getInventoryItems } from "@/lib/actions/inventory";
import { NewOrderClient } from "./new-order-client";

async function NewOrderContent() {
  // Klijenti se NE šalju svi u browser (4.000+) — wizard ih traži
  // serverskom pretragom (searchCustomersLite)
  const [materials, inventoryItems] = await Promise.all([
    getMaterials(),
    getInventoryItems(),
  ]);
  return <NewOrderClient materials={materials} inventoryItems={inventoryItems} />;
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Učitavanje...</div>}>
      <NewOrderContent />
    </Suspense>
  );
}
