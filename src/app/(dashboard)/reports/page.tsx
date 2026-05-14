import { getOrders } from "@/lib/actions/orders";
import { getCustomers } from "@/lib/actions/customers";
import { getCorrections } from "@/lib/actions/corrections";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const [orders, customers, corrections] = await Promise.all([
    getOrders(),
    getCustomers(),
    getCorrections(),
  ]);

  return <ReportsClient orders={orders} customers={customers} corrections={corrections} />;
}
