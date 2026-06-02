import { NextResponse } from "next/server";

// Test route — obrisati posle debugovanja
// Pristup: /api/test-gocreate?secret=gc-debug-2026
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "gc-debug-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = {
    UserName: process.env.GOCREATE_USERNAME,
    Password: process.env.GOCREATE_PASSWORD,
    AuthenticationToken: process.env.GOCREATE_AUTH_TOKEN,
  };

  const results: Record<string, unknown> = {
    envVarsPresent: {
      username: !!auth.UserName,
      password: !!auth.Password,
      token: !!auth.AuthenticationToken,
    },
  };

  // Test 1: Customer/Add bez ShopId
  try {
    const r1 = await fetch("https://api.gocreate.nu/Customer/Add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        FirstName: "Test",
        LastName: "Debug",
        Phone: "+38111111111",
        Email: "test@debug.com",
        SSID: "debug-test-001",
      }),
    });
    const text1 = await r1.text();
    results["test1_bez_ShopId"] = { status: r1.status, body: text1 };
  } catch (e) {
    results["test1_bez_ShopId"] = { error: String(e) };
  }

  // Test 2: Customer/Add sa ShopId
  try {
    const r2 = await fetch("https://api.gocreate.nu/Customer/Add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...auth,
        ShopId: 2293,
        FirstName: "Test",
        LastName: "Debug",
        Phone: "+38111111111",
        Email: "test@debug.com",
        SSID: "debug-test-002",
      }),
    });
    const text2 = await r2.text();
    results["test2_sa_ShopId"] = { status: r2.status, body: text2 };
  } catch (e) {
    results["test2_sa_ShopId"] = { error: String(e) };
  }

  // Test 3: Samo auth — provjeri da li token radi
  try {
    const r3 = await fetch("https://api.gocreate.nu/Customer/Search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...auth, ShopId: 2293, SearchText: "Test" }),
    });
    const text3 = await r3.text();
    results["test3_customer_search"] = { status: r3.status, body: text3 };
  } catch (e) {
    results["test3_customer_search"] = { error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
