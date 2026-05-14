import { getOrders } from "@/lib/actions/orders";
import { getCustomers } from "@/lib/actions/customers";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const [orders, customers, params] = await Promise.all([
    getOrders(),
    getCustomers(),
    searchParams,
  ]);
  return <OrdersClient orders={orders} customers={customers} initialFilter={params.filter} />;
}
