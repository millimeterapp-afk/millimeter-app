import { getProductionTasks, getProductionCorrections } from "@/lib/actions/production";
import { ProductionClient } from "./production-client";

export default async function ProductionPage() {
  const tasks = await getProductionTasks();
  const productionCorrections = await getProductionCorrections();
  return <ProductionClient tasks={tasks} productionCorrections={productionCorrections} />;
}
