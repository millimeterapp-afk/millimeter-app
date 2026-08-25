import { getSuppliers, getSupplierInvoices } from "@/lib/actions/suppliers";
import { getMaterials, getInventoryItems } from "@/lib/actions/inventory";
import { SuppliersClient } from "./suppliers-client";
import { guardSection } from "@/lib/access-guard";

export default async function SuppliersPage() {
  await guardSection("/suppliers");
  const [suppliersList, invoicesList, materialsList, itemsList] = await Promise.all([
    getSuppliers(),
    getSupplierInvoices(),
    getMaterials(),
    getInventoryItems(),
  ]);

  return (
    <SuppliersClient
      suppliers={suppliersList}
      invoices={invoicesList}
      materials={materialsList}
      inventoryItems={itemsList}
    />
  );
}
