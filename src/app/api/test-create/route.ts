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

  const pdBase = {
    StyleOrderNumber: "TEST-STYLE-001",
    FitAndTryOnData: {
      FitProfileName: "Slim Fit",
      FitToolData: {
        Neck: 39, Chest: 100, Waist: 90, Stomach: 92,
        Hips: 96, FrontLength: 72, BackLength: 74,
        Shoulder: 44, Back: 42, Sleeve: 62,
        Bicep: 34, Forearm: 26, Wrist: 17,
      },
    },
  };

  // T12: BrandingOptionData kao prazan niz
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: { ...orderBase, ProductData: [{ ...pdBase, BrandingOptionData: [] }] },
      }),
    });
    results["t12_branding_empty_list"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t12"] = String(e); }

  // T13: BrandingOptionData kao niz sa jednim praznim objektom
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: { ...orderBase, ProductData: [{ ...pdBase, BrandingOptionData: [{}] }] },
      }),
    });
    results["t13_branding_one_empty"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t13"] = String(e); }

  // T14: BrandingOptionData sa monogram poljima kao niz
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: {
          ...orderBase,
          ProductData: [{
            ...pdBase,
            BrandingOptionData: [{
              Monogram: "",
              MonogramPosition: "",
              MonogramColor: "",
              MonogramFont: "",
            }],
          }],
        },
      }),
    });
    results["t14_branding_monogram"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t14"] = String(e); }

  return NextResponse.json(results);
}
