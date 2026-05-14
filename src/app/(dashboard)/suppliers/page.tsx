import { getSuppliers, getSupplierInvoices } from "@/lib/actions/suppliers";
import { getMaterials, getInventoryItems } from "@/lib/actions/inventory";
import { SuppliersClient } from "./suppliers-client";

export default async function SuppliersPage() {
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
