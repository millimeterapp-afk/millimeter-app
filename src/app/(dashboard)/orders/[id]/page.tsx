import { getOrder } from "@/lib/actions/orders";
import { fetchGoCreateOrdersForCustomer } from "@/lib/actions/customers";
import { notFound } from "next/navigation";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return notFound();

  const gcOrders = order.productionFlow === "munro" && order.customerId
    ? await fetchGoCreateOrdersForCustomer(order.customerId)
    : [];

  return <OrderDetailClient order={order} gcOrders={gcOrders} />;
}
