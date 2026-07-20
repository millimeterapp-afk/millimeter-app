import { getNalozi } from "@/lib/actions/purchases";
import { getCustomerStats, getMunroYears } from "@/lib/actions/customers";
import { getCorrections } from "@/lib/actions/corrections";
import { ReportsClient } from "./reports-client";
import { MunroTopByYear } from "./munro-top-by-year";

export default async function ReportsPage() {
  const [orders, customerStats, corrections, munroYears] = await Promise.all([
    getNalozi(),
    getCustomerStats(),
    getCorrections(),
    getMunroYears(),
  ]);

  return (
    <div className="space-y-6">
      <ReportsClient orders={orders} customerStats={customerStats} corrections={corrections} />
      {munroYears.length > 0 && (
        <div className="p-6 max-w-7xl mx-auto pt-0">
          <MunroTopByYear years={munroYears} />
        </div>
      )}
    </div>
  );
}
