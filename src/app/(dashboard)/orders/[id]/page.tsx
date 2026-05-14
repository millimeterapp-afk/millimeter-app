import { getOrder } from "@/lib/actions/orders";
import { notFound } from "next/navigation";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return notFound();
  return <OrderDetailClient order={order} />;
}
