import { NextResponse } from "next/server";

// Privremena test ruta — proverava da li postoji endpoint za kreiranje naloga
// /api/test-create?secret=gc-debug-2026
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "gc-debug-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = {
    UserName: process.env.GOCREATE_USERNAME!,
    Password: process.env.GOCREATE_PASSWORD!,
    AuthenticationToken: process.env.GOCREATE_AUTH_TOKEN!,
  };

  const results: Record<string, unknown> = {};

  // Test 1: prazno OrderData
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, OrderData: {} }),
    });
    results["t1_empty_OrderData"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t1"] = String(e); }

  // Test 2: OrderData sa osnovnim poljima koja ima nalog
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: {
          ShopId: 2293,
          CustomerID: 520011,
          OrderType: "Shirt",
          FabricCode: "SH00014",
        }
      }),
    });
    results["t2_basic_fields"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t2"] = String(e); }

  // Test 3: OrderData kao lista
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: [{
          ShopId: 2293,
          CustomerID: 520011,
          OrderType: "Shirt",
        }]
      }),
    });
    results["t3_as_array"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t3"] = String(e); }

  // Test 4: OrderData sa FitProfileId
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: {
          ShopId: 2293,
          CustomerID: 520011,
          FitProfileId: 1,
          FabricCode: "SH00014",
          Quantity: 1,
        }
      }),
    });
    results["t4_with_fitprofile"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t4"] = String(e); }

  return NextResponse.json(results);
}
