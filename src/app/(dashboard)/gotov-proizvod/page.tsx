import { GotovProizvodClient } from "./gotov-proizvod-client";
import { guardSection } from "@/lib/access-guard";

export default async function GotovProizvodPage() {
  await guardSection("/gotov-proizvod");
  return <GotovProizvodClient />;
}
