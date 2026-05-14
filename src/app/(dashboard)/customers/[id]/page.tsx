import { getCustomer } from "@/lib/actions/customers";
import { notFound } from "next/navigation";
import { CustomerProfileClient } from "./customer-profile-client";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) return notFound();
  return <CustomerProfileClient customer={customer} />;
}
