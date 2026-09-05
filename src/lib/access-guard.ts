import "server-only";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth";
import { mozePristup, type UserRole } from "@/lib/access";

// Serverska zaštita strane: ako uloga ne sme na `href`, preusmeri na /dashboard.
// Koristi se na vrhu Server Component strane: `await guardSection("/reports");`
export async function guardSection(href: string) {
  const { dbUser } = await requireActiveUser();
  if (!mozePristup(dbUser.role as UserRole, href)) redirect("/dashboard");
}

// Serverska zaštita AKCIJE (ne stranice): baca grešku umesto redirect-a. Stranica
// može biti zaključana u meniju, ali server akcija je i dalje pozivljiva direktno
// (Server Action je zapravo HTTP endpoint) — svaka osetljiva akcija mora sama
// proveriti dozvolu, ne osloniti se na to da UI ne prikazuje dugme.
// Koristi se na vrhu server akcije: `await requireAccess("/customers");`
export async function requireAccess(href: string) {
  const { dbUser } = await requireActiveUser();
  if (!mozePristup(dbUser.role as UserRole, href)) {
    throw new Error("Nemaš pristup ovoj akciji.");
  }
  return dbUser;
}
