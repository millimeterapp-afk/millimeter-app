import { NalogKosuljaClient } from "./nalog-kosulja-client";
import { OrdersClient } from "../orders/orders-client";
import { getNalozi } from "@/lib/actions/purchases";
import { guardSection } from "@/lib/access-guard";

// Aleksandar (2.9): nalozi za košulju da se prikazuju ovde, ne u opštoj listi
// (koja je sad Munro-only). Forma za kreiranje + lista ispod nje.
export default async function NalogKosuljaPage() {
  await guardSection("/nalog-kosulja");
  const nalozi = await getNalozi("domaca");
  return (
    <>
      <NalogKosuljaClient />
      <OrdersClient
        nalozi={nalozi}
        title="Nalozi za košulju"
        subtitleExtra=""
        showNewButton={false}
      />
    </>
  );
}
