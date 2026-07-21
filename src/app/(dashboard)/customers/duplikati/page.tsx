import { getDuplicateCandidates } from "@/lib/actions/customers";
import { DuplikatiClient } from "./duplikati-client";

export default async function DuplikatiPage() {
  const { exactDupes, nameVariants } = await getDuplicateCandidates();
  return <DuplikatiClient exactDupes={exactDupes} nameVariants={nameVariants} />;
}
