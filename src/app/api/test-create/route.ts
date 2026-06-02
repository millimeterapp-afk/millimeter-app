import { NextResponse } from "next/server";

// Privremena test ruta — istraga strukture CreateOrder
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

  const fabric = { Id: 14, Name: "SH00014 white cotton twill" };
  const orderBase = {
    ShopId: 2293,
    CustomerID: 520011,
    Item: { Id: 8, Name: "Shirt" },
    Fabric: fabric,
    Status: "Processed",
    Occasion: "Everyday",
    ShopOrderNumber: "TEST-001",
  };

  // T5: input:{} prazan + OrderData sa ProductData kao prazan niz
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, input: {}, OrderData: { ...orderBase, ProductData: [] } }),
    });
    results["t5_input_empty_pd_array"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t5"] = String(e); }

  // T6: input = OrderData (isti objekat na oba mjesta)
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        input: { ...orderBase, ProductData: [] },
        OrderData: { ...orderBase, ProductData: [] },
      }),
    });
    results["t6_input_mirror_orderdata"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t6"] = String(e); }

  // T7: ProductData kao niz sa jednim objektom — {Id, Name, Quantity}
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        input: {},
        OrderData: {
          ...orderBase,
          ProductData: [{ Id: 8, Name: "Shirt", Quantity: 1 }],
        },
      }),
    });
    results["t7_pd_IdNameQty"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t7"] = String(e); }

  // T8: ProductData kao niz sa FitProfile-style objektom
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        input: {},
        OrderData: {
          ...orderBase,
          ProductData: [{
            Item: { Id: 8, Name: "Shirt" },
            Fabric: fabric,
            Quantity: 1,
          }],
        },
      }),
    });
    results["t8_pd_item_fabric"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t8"] = String(e); }

  return NextResponse.json(results);
}
