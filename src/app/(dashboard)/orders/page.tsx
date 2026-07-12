import { getNalozi } from "@/lib/actions/purchases";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const [nalozi, params] = await Promise.all([
    getNalozi(),
    searchParams,
  ]);
  return <OrdersClient nalozi={nalozi} initialFilter={params.filter} />;
}
