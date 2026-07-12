import { getNalozi, getPayments } from "@/lib/actions/purchases";
import { getCustomers } from "@/lib/actions/customers";
import { getCorrections } from "@/lib/actions/corrections";
import { getAppointments } from "@/lib/actions/appointments";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const today = new Date();
  const from = new Date(today); from.setHours(0, 0, 0, 0);
  const to = new Date(today); to.setHours(23, 59, 59, 999);

  const [nalozi, payments, customers, corrections, todayAppts] = await Promise.all([
    getNalozi(),
    getPayments(),
    getCustomers(),
    getCorrections(),
    getAppointments(from.toISOString(), to.toISOString()),
  ]);

  return (
    <DashboardClient
      nalozi={nalozi}
      payments={payments}
      customers={customers}
      corrections={corrections}
      todayAppointments={todayAppts}
    />
  );
}
