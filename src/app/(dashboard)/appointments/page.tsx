import { getAppointments } from "@/lib/actions/appointments";
import { AppointmentsClient } from "./appointments-client";

export default async function AppointmentsPage() {
  // Klijent se bira serverskom pretragom (CustomerPicker) — pun spisak se ne šalje
  const appts = await getAppointments();
  return <AppointmentsClient appointments={appts} />;
}
