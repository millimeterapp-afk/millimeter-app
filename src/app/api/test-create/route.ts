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

  const fitTool = [
    { Id: 1,  Name: "Neck",        Value: 39 },
    { Id: 2,  Name: "Chest",       Value: 100 },
    { Id: 3,  Name: "Waist",       Value: 90 },
    { Id: 4,  Name: "Stomach",     Value: 92 },
    { Id: 5,  Name: "Hips",        Value: 96 },
    { Id: 6,  Name: "FrontLength", Value: 72 },
    { Id: 7,  Name: "BackLength",  Value: 74 },
    { Id: 8,  Name: "Shoulder",    Value: 44 },
    { Id: 9,  Name: "Back",        Value: 42 },
    { Id: 10, Name: "Sleeve",      Value: 62 },
    { Id: 11, Name: "Bicep",       Value: 34 },
    { Id: 12, Name: "Forearm",     Value: 26 },
    { Id: 13, Name: "Wrist",       Value: 17 },
  ];

  const makeProduct = (productPartId: number) => ({
    ProductPartId: productPartId,
    StyleOrderNumber: "TEST-STYLE-001",
    BrandingOptionData: [],
    FitAndTryOnData: { FitProfileName: "Slim Fit", FitToolData: fitTool },
  });

  // T21: Dohvati nedavne naloge za shop 2293 da nađemo prave OrderNumber-e
  try {
    const r = await fetch("https://api.gocreate.nu/Order/ByDate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, ShopId: 2293, Date: "2026-01-01" }),
    });
    results["t21_orders_by_date"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t21"] = String(e); }

  // T22: Dohvati nalog po broju — probaj drugačiji format
  try {
    const r = await fetch("https://api.gocreate.nu/Order/ByOrderNumber", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, ShopId: 2293, OrderNumber: "MILL.110.RS.34" }),
    });
    results["t22_order_short_format"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t22"] = String(e); }

  // T23-T26: Brute force ProductPartId (1, 2, 3, 100)
  for (const ppId of [1, 2, 3, 100]) {
    try {
      const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...auth, input: {},
          OrderData: { ...orderBase, ProductData: [makeProduct(ppId)] },
        }),
      });
      results[`t_ppid_${ppId}`] = { status: r.status, body: await r.text() };
    } catch (e) { results[`t_ppid_${ppId}`] = String(e); }
  }

  return NextResponse.json(results);
}
