import { getNalozi } from "@/lib/actions/purchases";
import { OrdersClient } from "./orders-client";
import { guardSection } from "@/lib/access-guard";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await guardSection("/orders");
  const [nalozi, params] = await Promise.all([
    getNalozi("munro"),
    searchParams,
  ]);
  return <OrdersClient nalozi={nalozi} initialFilter={params.filter} />;
}
