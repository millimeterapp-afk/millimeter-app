import { NalogKosuljaClient } from "./nalog-kosulja-client";
import { guardSection } from "@/lib/access-guard";

export default async function NalogKosuljaPage() {
  await guardSection("/nalog-kosulja");
  return <NalogKosuljaClient />;
}
