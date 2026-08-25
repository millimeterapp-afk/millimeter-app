import { getCorrections } from "@/lib/actions/corrections";
import { CorrectionsClient } from "./corrections-client";
import { guardSection } from "@/lib/access-guard";

export default async function CorrectionsPage() {
  await guardSection("/corrections");
  // Klijent se bira serverskom pretragom (CustomerPicker); nalog dolazi iz relacije
  const corrections = await getCorrections();
  return <CorrectionsClient corrections={corrections} />;
}
