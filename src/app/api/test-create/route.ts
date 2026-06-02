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

  // Sva poznata polja, ProductData = prazan objekat — vidimo šta traži
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: {
          ShopId: 2293,
          CustomerID: 520011,
          Item: 8,              // OrderTypeId: 8 = Shirt
          Fabric: "SH00014",
          Status: "Processed",
          Occasion: "Everyday",
          ShopOrderNumber: "",
          ProductData: {},
        }
      }),
    });
    results["t1_all_fields_empty_ProductData"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t1"] = String(e); }

  // Item kao string
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: {
          ShopId: 2293,
          CustomerID: 520011,
          Item: "Shirt",
          Fabric: "SH00014",
          Status: "Processed",
          Occasion: "Everyday",
          ShopOrderNumber: "",
          ProductData: {},
        }
      }),
    });
    results["t2_item_as_string"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t2"] = String(e); }

  // ProductData sa merama košulje (iz nalog za košulju format)
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        OrderData: {
          ShopId: 2293,
          CustomerID: 520011,
          Item: "Shirt",
          Fabric: "SH00014",
          Status: "Processed",
          Occasion: "Everyday",
          ShopOrderNumber: "TEST-001",
          ProductData: {
            Neck: "39",
            Chest: "100",
            Waist: "92",
            Hips: "100",
            ShoulderWidth: "46",
            SleeveLength: "65",
            CollarType: "Classic",
            CuffType: "Single",
            Fit: "Slim fit",
          },
        }
      }),
    });
    results["t3_with_measures"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t3"] = String(e); }

  return NextResponse.json(results);
}
