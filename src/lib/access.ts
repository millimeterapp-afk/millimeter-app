// Pravila pristupa po ulozi (jedan izvor istine). Čist modul — koriste ga i sidebar
// (klijent) i serverska zaštita. Odluke (Matej „uradi kako mislis", 25.8), po
// Aleksandrovoj matrici:
//   owner (vlasnik)            → sve
//   store_manager             → sve za lokal + Izveštaji (bez admina)
//   store_employee (radnik)   → sve za lokal (uklj. Dobavljače), bez Izveštaja/admina
//   production_employee       → Produkcija, Korekcije, Zalihe (uprošteno)
//   accountant (finansije)    → Izveštaji
export type UserRole = "owner" | "store_manager" | "store_employee" | "production_employee" | "accountant";

const OPERATIVA = [
  "/dashboard", "/customers", "/appointments", "/orders", "/nalog-kosulja",
  "/gotov-proizvod", "/production", "/corrections", "/inventory", "/barcodes",
  "/sales", "/suppliers",
];
const FINANSIJE = ["/reports"];

export function dozvoljeneSekcije(role: UserRole | undefined | null): string[] | "*" {
  switch (role) {
    case "owner": return "*";
    case "store_manager": return [...OPERATIVA, ...FINANSIJE];
    case "store_employee": return OPERATIVA;
    case "production_employee": return ["/dashboard", "/production", "/corrections", "/inventory"];
    case "accountant": return ["/dashboard", "/reports"];
    default: return ["/dashboard"];
  }
}

// Da li uloga sme na dati href (tačno poklapanje ili podputanja /orders/123).
export function mozePristup(role: UserRole | undefined | null, href: string): boolean {
  const d = dozvoljeneSekcije(role);
  if (d === "*") return true;
  return d.some((p) => href === p || href.startsWith(p + "/"));
}
