import { getDuplicateCandidates } from "@/lib/actions/customers";
import { DuplikatiClient } from "./duplikati-client";
import { guardSection } from "@/lib/access-guard";

export default async function DuplikatiPage() {
  await guardSection("/customers");
  const { exactDupes, nameVariants } = await getDuplicateCandidates();
  return <DuplikatiClient exactDupes={exactDupes} nameVariants={nameVariants} />;
}
