import { getMaterials, getInventoryItemsPage, getInventoryStats } from "@/lib/actions/inventory";
import { InventoryClient } from "./inventory-client";
import { guardSection } from "@/lib/access-guard";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await guardSection("/inventory");
  const params = await searchParams;
  const q = params.q ?? "";
  const reqPage = Number(params.page) || 1;
  // Gotova roba (1607) se NE učitava cela — server paginira/pretražuje. Materijali (malo) idu cela.
  const [materials, stats, { items, total, page }] = await Promise.all([
    getMaterials(),
    getInventoryStats(),
    getInventoryItemsPage(q, reqPage),
  ]);
  return (
    <InventoryClient
      materials={materials}
      items={items}
      total={total}
      stats={stats}
      q={q}
      page={page}
    />
  );
}
