import { getNalozi } from "@/lib/actions/purchases";
import { getCustomerStats } from "@/lib/actions/customers";
import { getCorrections } from "@/lib/actions/corrections";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const [orders, customerStats, corrections] = await Promise.all([
    getNalozi(),
    getCustomerStats(),
    getCorrections(),
  ]);

  return <ReportsClient orders={orders} customerStats={customerStats} corrections={corrections} />;
}
