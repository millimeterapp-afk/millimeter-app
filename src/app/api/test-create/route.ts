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

  // Minimalni ProductData sa svim required poljima (prazni objekti)
  const pdMinimal = {
    StyleOrderNumber: "TEST-STYLE-001",
    BrandingOptionData: {},
    FitAndTryOnData: {
      FitProfileName: "Slim Fit",
      FitToolData: {},
    },
  };

  // T9: Minimalni ProductData — da vidimo koji sub-fieldi su required
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: { ...orderBase, ProductData: [pdMinimal] },
      }),
    });
    results["t9_pd_minimal"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t9"] = String(e); }

  // T10: FitToolData sa mjerama košulje
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: {
          ...orderBase,
          ProductData: [{
            ...pdMinimal,
            FitAndTryOnData: {
              FitProfileName: "Slim Fit",
              FitToolData: {
                Neck: 39, Chest: 100, Waist: 90, Stomach: 92,
                Hips: 96, FrontLength: 72, BackLength: 74,
                Shoulder: 44, Back: 42, Sleeve: 62,
                Bicep: 34, Forearm: 26, Wrist: 17,
              },
            },
          }],
        },
      }),
    });
    results["t10_pd_measurements"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t10"] = String(e); }

  // T11: BrandingOptionData sa mogućim poljima
  try {
    const r = await fetch("https://api.gocreate.nu/Order/CreateOrder", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth, input: {},
        OrderData: {
          ...orderBase,
          ProductData: [{
            ...pdMinimal,
            BrandingOptionData: {
              Monogram: "",
              MonogramPosition: "",
              MonogramColor: "",
              MonogramFont: "",
            },
          }],
        },
      }),
    });
    results["t11_branding_fields"] = { status: r.status, body: await r.text() };
  } catch (e) { results["t11"] = String(e); }

  return NextResponse.json(results);
}
