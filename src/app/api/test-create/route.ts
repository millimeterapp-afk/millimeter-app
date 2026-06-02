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

  const itemObj = { Id: 8, Name: "Shirt" };
  const orderBase = {
    ShopId: 2293,
    CustomerID: 520011,
    Item: itemObj,
    Fabric: "SH00014",
    Status: "Processed",
    Occasion: "Everyday",
    ShopOrderNumber: "TEST-001",
  };

  // T1: OrderData + Item kao {Id,Name}, ProductData prazan
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, OrderData: { ...orderBase, ProductData: {} } }),
    });
    results["t1_item_IdAndName"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t1"] = String(e); }

  // T2: input kao wrapper oko OrderData
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, input: { OrderData: { ...orderBase, ProductData: {} } } }),
    });
    results["t2_input_wrapper"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t2"] = String(e); }

  // T3: input = orderBase direktno (bez OrderData wrappera)
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, input: { ...orderBase, ProductData: {} } }),
    });
    results["t3_input_flat"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t3"] = String(e); }

  // T4: Fabric kao {Id,Name} objekat (kao Item)
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: {
          ...orderBase,
          Fabric: { Id: 14, Name: "SH00014 white cotton twill" },
          ProductData: {}
        }
      }),
    });
    results["t4_fabric_IdAndName"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t4"] = String(e); }

  return NextResponse.json(results);
}
