import { Suspense } from "react";
import { getCustomers } from "@/lib/actions/customers";
import { getMaterials } from "@/lib/actions/inventory";
import { NewOrderClient } from "./new-order-client";

async function NewOrderContent() {
  const [customers, materials] = await Promise.all([getCustomers(), getMaterials()]);
  return <NewOrderClient customers={customers} materials={materials} />;
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Učitavanje...</div>}>
      <NewOrderContent />
    </Suspense>
  );
}
