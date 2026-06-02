import { NextResponse } from "next/server";
import { addGoCreateCustomer, searchGoCreateCustomerByName, getGoCreateOrders } from "@/lib/gocreate";

// Privremeni test endpoint — obrisati posle potvrde
// /api/gc-test?secret=gc-debug-2026
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "gc-debug-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // T1: Customer/Add — "TEST PROBA" sa MobileNumber
  try {
    const res = await addGoCreateCustomer({
      firstName: "TEST",
      lastName: "PROBA",
      phone: "+381641234567",
      email: "test.proba@millimeter.me",
      ssid: "MM-TEST-001",
    });
    results["t1_customer_add"] = res;
  } catch (e) {
    results["t1_customer_add"] = { error: String(e) };
  }

  // T2: Order/ByCustomerId — koristi CustomerID koji je vratio T1 (ako je prošao)
  // Takođe probaj sa poznatim ID-em 520011 iz prethodnih testova
  try {
    const orders = await getGoCreateOrders(520011);
    results["t2_orders_by_customer"] = { count: orders.length, orders };
  } catch (e) {
    results["t2_orders_by_customer"] = { error: String(e) };
  }

  // T3: Customer/Search — FirstName + LastName + PageSize
  try {
    const id = await searchGoCreateCustomerByName("TEST", "PROBA");
    results["t3_customer_search"] = { foundId: id };
  } catch (e) {
    results["t3_customer_search"] = { error: String(e) };
  }

  return NextResponse.json(results);
}
