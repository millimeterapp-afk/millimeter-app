import { GotovProizvodClient } from "./gotov-proizvod-client";
import { OrdersClient } from "../orders/orders-client";
import { getNalozi } from "@/lib/actions/purchases";
import { guardSection } from "@/lib/access-guard";

// Aleksandar (5.9): spisak prodatog + istorija kupovine ovde, isti obrazac kao
// Nalog za košulju. Forma za kreiranje + lista ispod nje.
export default async function GotovProizvodPage() {
  await guardSection("/gotov-proizvod");
  const nalozi = await getNalozi("gotov");
  return (
    <>
      <GotovProizvodClient />
      <OrdersClient
        nalozi={nalozi}
        title="Prodato — istorija"
        subtitleExtra=""
        showNewButton={false}
      />
    </>
  );
}
