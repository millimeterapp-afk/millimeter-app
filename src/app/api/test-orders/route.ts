import { NextResponse } from "next/server";

// Privremena test ruta — obrisati posle
// /api/test-orders?secret=gc-debug-2026
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

  // Nikola Miljkovic GoCreate ID = 520011, ima 114 naloga
  const results: Record<string, unknown> = {};

  // Test 1: CustomerID (veliko ID) bez ShopId
  try {
    const r = await fetch("https://api.gocreate.nu/Order/ByCustomerId", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, CustomerID: 520011 }),
    });
    const text = await r.text();
    const json = JSON.parse(text);
    results["test1_CustomerID_bez_ShopId"] = {
      status: r.status,
      orderCount: Array.isArray(json) ? json.length : (json.Orders?.length ?? "nije niz"),
      prvaNaloga: Array.isArray(json) ? json.slice(0, 2) : json,
    };
  } catch (e) { results["test1"] = { error: String(e) }; }

  // Test 2: CustomerId (malo d) bez ShopId
  try {
    const r = await fetch("https://api.gocreate.nu/Order/ByCustomerId", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, CustomerId: 520011 }),
    });
    const text = await r.text();
    const json = JSON.parse(text);
    results["test2_CustomerId_bez_ShopId"] = {
      status: r.status,
      orderCount: Array.isArray(json) ? json.length : (json.Orders?.length ?? "nije niz"),
      prvaNaloga: Array.isArray(json) ? json.slice(0, 2) : json,
    };
  } catch (e) { results["test2"] = { error: String(e) }; }

  // Test 3: CustomerID sa ShopId
  try {
    const r = await fetch("https://api.gocreate.nu/Order/ByCustomerId", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, CustomerID: 520011, ShopId: 2293 }),
    });
    const text = await r.text();
    const json = JSON.parse(text);
    results["test3_CustomerID_sa_ShopId"] = {
      status: r.status,
      orderCount: Array.isArray(json) ? json.length : (json.Orders?.length ?? "nije niz"),
      prvaNaloga: Array.isArray(json) ? json.slice(0, 2) : json,
    };
  } catch (e) { results["test3"] = { error: String(e) }; }

  // Test 4: OrderDeliveryInfoByStatus — svi aktivni nalozi radnje
  try {
    const r = await fetch("https://api.gocreate.nu/Order/OrderDeliveryInfoByStatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, ShopId: 2293, StatusId: 46 }), // 46 = Out for delivery
    });
    const text = await r.text();
    const json = JSON.parse(text);
    results["test4_OrderDeliveryInfoByStatus"] = {
      status: r.status,
      count: Array.isArray(json) ? json.length : "nije niz",
      prviNalog: Array.isArray(json) ? json[0] : json,
    };
  } catch (e) { results["test4"] = { error: String(e) }; }

  return NextResponse.json(results);
}
