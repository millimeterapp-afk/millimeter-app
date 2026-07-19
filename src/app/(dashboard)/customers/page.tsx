import { getCustomersPage, getCustomerStats } from "@/lib/actions/customers";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const page = Number(params.page) || 1;
  const [{ customers, total }, stats] = await Promise.all([
    getCustomersPage(q, page),
    getCustomerStats(),
  ]);
  return <CustomersClient customers={customers} total={total} q={q} page={page} stats={stats} />;
}
