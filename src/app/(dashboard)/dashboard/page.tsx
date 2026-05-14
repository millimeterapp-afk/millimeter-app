import { getOrders } from "@/lib/actions/orders";
import { getCustomers } from "@/lib/actions/customers";
import { getProductionTasks } from "@/lib/actions/production";
import { getCorrections } from "@/lib/actions/corrections";
import { getAppointments } from "@/lib/actions/appointments";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const today = new Date();
  const from = new Date(today); from.setHours(0, 0, 0, 0);
  const to = new Date(today); to.setHours(23, 59, 59, 999);

  const [orders, customers, tasks, corrections, todayAppts] = await Promise.all([
    getOrders(),
    getCustomers(),
    getProductionTasks(),
    getCorrections(),
    getAppointments(from.toISOString(), to.toISOString()),
  ]);

  return (
    <DashboardClient
      orders={orders}
      customers={customers}
      tasks={tasks}
      corrections={corrections}
      todayAppointments={todayAppts}
    />
  );
}
