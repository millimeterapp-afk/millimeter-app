import { getAppointments } from "@/lib/actions/appointments";
import { getCustomers } from "@/lib/actions/customers";
import { AppointmentsClient } from "./appointments-client";

export default async function AppointmentsPage() {
  const [appts, customers] = await Promise.all([
    getAppointments(),
    getCustomers(),
  ]);

  return <AppointmentsClient appointments={appts} customers={customers} />;
}
