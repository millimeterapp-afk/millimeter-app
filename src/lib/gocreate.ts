const BASE_URL = "https://api.gocreate.nu";
const SHOP_ID = 2293; // Millimeter CC — koristiti samo za Search, NE za Customer/Add

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
  CustomerID?: number;
  IsValidResult?: boolean;
  ErrorCode?: string[];
  ErrorMessage?: string[];
}

interface GoCreateCustomerInfo {
  Id?: number;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  CustomerNumber?: string;
}

interface GoCreateSearchResult {
  CustomerInfo?: GoCreateCustomerInfo[];
}

export interface GoCreateOrder {
  OrderNumber: string;
  OrderType: string;
  Status: string;
  Fabric: string;
  Lining: string | null;
  DeliveryDate: string;
  UpdatedDeliveryDate: string;
  CustomerName: string;
  PPrice: string;
  CreatedDate: string;
  UrgentOrder: string;
  ShopOrderComment: string;
}

interface GoCreateOrdersResponse {
  Orders?: GoCreateOrder[];
  IsValidResult?: boolean;
}

// ─── Customer ─────────────────────────────────────────────

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
    MobileNumber: customer.phone ?? "",
    Email: customer.email ?? "",
    SSID: customer.ssid,
  });

  console.log("[GoCreate] addCustomer response:", JSON.stringify(result));

  const alreadyExists = result.ErrorCode?.includes("ALREADY_EXISTS") ?? false;
  const id = result.CustomerID && result.CustomerID > 0 ? result.CustomerID : null;

  return { id, alreadyExists };
}

export async function searchGoCreateCustomerByName(
  firstName: string,
  lastName: string
): Promise<number | null> {
  try {
    const result = await post<GoCreateSearchResult>("/Customer/Search", {
      FirstName: firstName,
      LastName: lastName,
      PageSize: 10,
    });

    if (!result.CustomerInfo?.length) return null;

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

/** Dohvata naloge klijenta iz GoCreate. Odgovor: { Orders: [...], IsValidResult: true } */
export async function getGoCreateOrders(goCreateCustomerId: number): Promise<GoCreateOrder[]> {
  try {
    const result = await post<GoCreateOrdersResponse>("/Order/ByCustomerId", {
      CustomerID: goCreateCustomerId,
    });
    return result.Orders ?? [];
  } catch (err) {
    console.error("[GoCreate] getOrders failed:", err);
    return [];
  }
}
