import { getCustomer } from "@/lib/actions/customers";
import { getCustomerAppointments } from "@/lib/actions/appointments";
import { getGoCreateOrders } from "@/lib/gocreate";
import { notFound } from "next/navigation";
import { CustomerProfileClient } from "./customer-profile-client";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [customer, appointments] = await Promise.all([
    getCustomer(id),
    getCustomerAppointments(id),
  ]);
  if (!customer) return notFound();

  const munroOrders = customer.goCreateCustomerId
    ? await getGoCreateOrders(Number(customer.goCreateCustomerId))
    : [];

  return <CustomerProfileClient customer={customer} appointments={appointments} munroOrders={munroOrders} />;
}
