import { getAppointments } from "@/lib/actions/appointments";
import { AppointmentsClient } from "./appointments-client";
import { guardSection } from "@/lib/access-guard";

export default async function AppointmentsPage() {
  await guardSection("/appointments");
  // Klijent se bira serverskom pretragom (CustomerPicker) — pun spisak se ne šalje
  const appts = await getAppointments();
  return <AppointmentsClient appointments={appts} />;
}
