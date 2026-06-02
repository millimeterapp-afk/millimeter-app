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

  const makeProduct = (extra: Record<string, unknown> = {}) => ({
    StyleOrderNumber: "TEST-STYLE-001",
    BrandingOptionData: [],
    FitAndTryOnData: { FitProfileName: "Slim Fit", FitToolData: fitTool },
    ...extra,
  });

  // T18: Dohvati pravi Munro nalog da vidimo ProductData strukturu
  try {
    const r = await fetch("https://api.gocreate.nu/Order/ByOrderNumber", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, ShopId: 2293, OrderNumber: "MILL.110.RS.0000034" }),
    });
    results["t18_fetch_real_order"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t18"] = String(e); }

  // T19: ProductData item sa Id: 8 (shirt type ID)
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: { ...orderBase, ProductData: [makeProduct({ Id: 8 })] },
      }),
    });
    results["t19_pd_id8"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t19"] = String(e); }

  // T20: ProductData item sa ProductPartId: 8
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: { ...orderBase, ProductData: [makeProduct({ ProductPartId: 8 })] },
      }),
    });
    results["t20_pd_productpartid8"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t20"] = String(e); }

  return NextResponse.json(results);
}
