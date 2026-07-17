// Centralni auth za Server Actions.
// OBAVEZNO koristiti umjesto lokalnih kopija getCurrentUser/getCompanyId —
// jedino ovdje se provjerava i users.isActive (deaktiviran radnik NE smije
// zadržati pristup kroz postojeću sesiju).
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function requireActiveUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  const dbUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user.id),
  });
  if (!dbUser?.companyId) throw new Error("Nemaš kompaniju");
  if (!dbUser.isActive) throw new Error("Nalog je deaktiviran — javi se vlasniku.");

  return { user, dbUser, companyId: dbUser.companyId };
}
