import { getCorrections } from "@/lib/actions/corrections";
import { CorrectionsClient } from "./corrections-client";

export default async function CorrectionsPage() {
  // Klijent se bira serverskom pretragom (CustomerPicker); nalog dolazi iz relacije
  const corrections = await getCorrections();
  return <CorrectionsClient corrections={corrections} />;
}
