import { Suspense } from "react";
import { getInventoryItems } from "@/lib/actions/inventory";
import { NewOrderClient } from "./new-order-client";

async function NewOrderContent() {
  // Klijenti se NE šalju svi u browser (4.000+) — wizard ih traži serverskom pretragom.
  // Materijali se takođe traže na serveru (2.000+) preko MaterialPicker-a (searchMaterials).
  const inventoryItems = await getInventoryItems();
  return <NewOrderClient inventoryItems={inventoryItems} />;
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Učitavanje...</div>}>
      <NewOrderContent />
    </Suspense>
  );
}
