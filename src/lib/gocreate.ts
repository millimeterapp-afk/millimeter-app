const BASE_URL = "https://api.gocreate.nu";
const SHOP_ID = 2293; // Millimeter CC

function getAuth() {
  return {
    UserName: process.env.GOCREATE_USERNAME!,
    Password: process.env.GOCREATE_PASSWORD!,
    AuthenticationToken: process.env.GOCREATE_AUTH_TOKEN!,
  };
}

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getAuth(), ...body }),
    next: { revalidate: 0 },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`GoCreate ${endpoint} → HTTP ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`GoCreate ${endpoint} → invalid JSON: ${text}`);
  }
}

// ─── Customer ─────────────────────────────────────────────

export interface GoCreateAddCustomerResult {
  CustomerId?: number;
  Id?: number;
  CustomerID?: number;
  CustomerCode?: string;
  Success?: boolean;
  Error?: string;
  Message?: string;
}

export interface GoCreateOrderStatus {
  OrderId?: number;
  OrderNumber?: string;
  Status?: string;
  StatusText?: string;
  DeliveryDate?: string;
  Description?: string;
}

/** Dodaje klijenta u GoCreate i vraća njihov numerički ID. */
export async function addGoCreateCustomer(customer: {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  ssid: string;
}): Promise<number | null> {
  try {
    const result = await post<GoCreateAddCustomerResult>("/Customer/Add", {
      ShopId: SHOP_ID,
      FirstName: customer.firstName,
      LastName: customer.lastName,
      Phone: customer.phone ?? "",
      Email: customer.email ?? "",
      SSID: customer.ssid,
    });

    console.log("[GoCreate] addCustomer response:", JSON.stringify(result));

    const id = result.CustomerId ?? result.Id ?? result.CustomerID ?? null;
    return id ? Number(id) : null;
  } catch (err) {
    console.error("[GoCreate] addCustomer failed:", err);
    // Propagiraj grešku dalje da je UI može prikazati
    throw err;
  }
}

/** Pretraži klijenta u GoCreate po SSID-u (naš interni ID). */
export async function searchGoCreateCustomer(ssid: string): Promise<number | null> {
  try {
    const result = await post<{ Customers?: Array<{ CustomerId?: number; SSID?: string }> }>(
      "/Customer/Search",
      { ShopId: SHOP_ID, SSID: ssid }
    );

    const match = result.Customers?.find((c) => c.SSID === ssid);
    return match?.CustomerId ? Number(match.CustomerId) : null;
  } catch {
    return null;
  }
}

/** Dohvata naloge klijenta iz GoCreate (za prikaz statusa Munro naloga). */
export async function getGoCreateOrders(goCreateCustomerId: number): Promise<GoCreateOrderStatus[]> {
  try {
    const result = await post<GoCreateOrderStatus[] | { Orders?: GoCreateOrderStatus[] }>(
      "/Order/ByCustomerId",
      { ShopId: SHOP_ID, CustomerId: goCreateCustomerId }
    );

    if (Array.isArray(result)) return result;
    if (result && "Orders" in result && Array.isArray(result.Orders)) return result.Orders;
    return [];
  } catch (err) {
    console.error("[GoCreate] getOrders failed:", err);
    return [];
  }
}
