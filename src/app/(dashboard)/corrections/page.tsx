import { getCorrections } from "@/lib/actions/corrections";
import { getCustomers } from "@/lib/actions/customers";
import { getOrders } from "@/lib/actions/orders";
import { CorrectionsClient } from "./corrections-client";

export default async function CorrectionsPage() {
  const [corrections, customers, orders] = await Promise.all([
    getCorrections(),
    getCustomers(),
    getOrders(),
  ]);
  return <CorrectionsClient corrections={corrections} customers={customers} orders={orders} />;
}
