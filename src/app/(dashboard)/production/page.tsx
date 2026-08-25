import { getNaloziForProduction } from "@/lib/actions/purchases";
import { getProductionCorrections } from "@/lib/actions/production";
import { ProductionClient } from "./production-client";
import { guardSection } from "@/lib/access-guard";

export default async function ProductionPage() {
  await guardSection("/production");
  const [nalozi, productionCorrections] = await Promise.all([
    getNaloziForProduction(),
    getProductionCorrections(),
  ]);
  return <ProductionClient nalozi={nalozi} productionCorrections={productionCorrections} />;
}
