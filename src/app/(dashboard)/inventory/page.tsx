import { getMaterials, getInventoryItemsPage, getInventoryStats } from "@/lib/actions/inventory";
import { getCurrentProfile } from "@/lib/actions/settings";
import { InventoryClient } from "./inventory-client";
import { guardSection } from "@/lib/access-guard";
import type { UserRole } from "@/lib/access";

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
  const [materials, stats, { items, total, page }, profile] = await Promise.all([
    getMaterials(),
    getInventoryStats(),
    getInventoryItemsPage(q, reqPage),
    getCurrentProfile(),
  ]);
  return (
    <InventoryClient
      materials={materials}
      items={items}
      total={total}
      stats={stats}
      q={q}
      page={page}
      userRole={profile?.role as UserRole | undefined}
    />
  );
}
