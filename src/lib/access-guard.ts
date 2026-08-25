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
