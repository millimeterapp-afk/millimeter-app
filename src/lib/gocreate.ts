const BASE_URL = "https://api.gocreate.nu";

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

  if (!res.ok) {
    throw new Error(`GoCreate ${endpoint} → ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ─── Customer ─────────────────────────────────────────────

export interface GoCreateAddCustomerResult {
  CustomerId?: number;
  Id?: number;
  CustomerID?: number;
  Success?: boolean;
  Error?: string;
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
  ssid: string; // naš interni UUID — laka bidirekciona sinhronizacija
}): Promise<number | null> {
  try {
    const result = await post<GoCreateAddCustomerResult>("/Customer/Add", {
      FirstName: customer.firstName,
      LastName: customer.lastName,
      Phone: customer.phone ?? "",
      Email: customer.email ?? "",
      SSID: customer.ssid,
    });

    const id = result.CustomerId ?? result.Id ?? result.CustomerID ?? null;
    return id ? Number(id) : null;
  } catch (err) {
    console.error("[GoCreate] addCustomer failed:", err);
    return null;
  }
}

/** Pretraži klijenta u GoCreate po SSID-u (naš interni ID). */
export async function searchGoCreateCustomer(ssid: string): Promise<number | null> {
  try {
    const result = await post<{ Customers?: Array<{ CustomerId?: number; SSID?: string }> }>(
      "/Customer/Search",
      { SSID: ssid }
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
      { CustomerId: goCreateCustomerId }
    );

    if (Array.isArray(result)) return result;
    if (result && "Orders" in result && Array.isArray(result.Orders)) return result.Orders;
    return [];
  } catch (err) {
    console.error("[GoCreate] getOrders failed:", err);
    return [];
  }
}
