const BASE_URL = "https://api.gocreate.nu";
const SHOP_ID = 2293; // Millimeter CC — koristiti samo za Search i Orders, NE za Customer/Add

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

// ─── Tipovi ───────────────────────────────────────────────

interface GoCreateAddResult {
  FirstName?: string;
  LastName?: string;
  CustomerID?: number;       // ID pri uspešnom kreiranju (> 0)
  IsValidResult?: boolean;
  ErrorCode?: string[];
  ErrorMessage?: string[];
}

interface GoCreateCustomerInfo {
  Id?: number;               // ID u Search odgovoru
  FirstName?: string;
  LastName?: string;
  Email?: string;
  CustomerNumber?: string;
}

interface GoCreateSearchResult {
  CustomerInfo?: GoCreateCustomerInfo[];
}

export interface GoCreateOrderStatus {
  OrderId?: number;
  OrderNumber?: string;
  Status?: string;
  StatusText?: string;
  DeliveryDate?: string;
  Description?: string;
}

// ─── Customer ─────────────────────────────────────────────

/**
 * Dodaje klijenta u GoCreate.
 * - BEZ ShopId — sa ShopId API vraća CustomerID:0 i kvari odgovor
 * - Vraća numerički ID ili null ako ne uspe
 */
export async function addGoCreateCustomer(customer: {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  ssid: string;
}): Promise<{ id: number | null; alreadyExists: boolean }> {
  const result = await post<GoCreateAddResult>("/Customer/Add", {
    FirstName: customer.firstName,
    LastName: customer.lastName,
    Phone: customer.phone ?? "",
    Email: customer.email ?? "",
    SSID: customer.ssid,
  });

  console.log("[GoCreate] addCustomer response:", JSON.stringify(result));

  const alreadyExists = result.ErrorCode?.includes("ALREADY_EXISTS") ?? false;
  const id = result.CustomerID && result.CustomerID > 0 ? result.CustomerID : null;

  return { id, alreadyExists };
}

/**
 * Pretraži klijenta u GoCreate po imenu.
 * Koristi se kad Customer/Add vrati ALREADY_EXISTS.
 */
export async function searchGoCreateCustomerByName(
  firstName: string,
  lastName: string
): Promise<number | null> {
  try {
    const result = await post<GoCreateSearchResult>("/Customer/Search", {
      ShopId: SHOP_ID,
      SearchText: `${firstName} ${lastName}`,
    });

    console.log("[GoCreate] search response (first 3):", JSON.stringify(result.CustomerInfo?.slice(0, 3)));

    if (!result.CustomerInfo?.length) return null;

    // Nađi tačan match po imenu (case-insensitive)
    const match = result.CustomerInfo.find(
      (c) =>
        c.FirstName?.toLowerCase().trim() === firstName.toLowerCase().trim() &&
        c.LastName?.toLowerCase().trim() === lastName.toLowerCase().trim()
    );

    return match?.Id ?? null;
  } catch (err) {
    console.error("[GoCreate] searchByName failed:", err);
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
