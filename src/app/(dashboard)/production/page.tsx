import { getNaloziForProduction } from "@/lib/actions/purchases";
import { getProductionCorrections } from "@/lib/actions/production";
import { ProductionClient } from "./production-client";

export default async function ProductionPage() {
  const [nalozi, productionCorrections] = await Promise.all([
    getNaloziForProduction(),
    getProductionCorrections(),
  ]);
  return <ProductionClient nalozi={nalozi} productionCorrections={productionCorrections} />;
}
