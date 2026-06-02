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

  const endpoints = [
    "/Order/Add",
    "/Order/Create",
    "/Order/New",
    "/Order/CreateOrder",
    "/Order/AddOrder",
    "/FitProfile/Add",
    "/FitProfile/Create",
    "/Order/PlaceOrder",
    "/Order/Submit",
  ];

  const results: Record<string, unknown> = {};

  for (const endpoint of endpoints) {
    try {
      const r = await fetch(`https://api.gocreate.nu${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, ShopId: 2293 }),
      });
      const text = await r.text();
      results[endpoint] = { status: r.status, body: text.slice(0, 200) };
    } catch (e) {
      results[endpoint] = { error: String(e) };
    }
  }

  return NextResponse.json(results);
}
