import { Suspense } from "react";
import { NewOrderClient } from "./new-order-client";
import { guardSection } from "@/lib/access-guard";

// Sad isključivo Munro nalog (R6, 2.9) — Nalog za košulju i Gotov proizvod imaju svoje
// ekrane. Klijenti se traže serverskom pretragom (4.000+), ne šalju se svi u browser.
export default async function NewOrderPage() {
  await guardSection("/orders");
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Učitavanje...</div>}>
      <NewOrderClient />
    </Suspense>
  );
}
