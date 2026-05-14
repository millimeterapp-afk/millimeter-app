"use server";

import { db } from "@/lib/db";
import { users, companies } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nisi prijavljen");

  const dbUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user.id),
  });
  if (!dbUser?.companyId) throw new Error("Nemaš kompaniju");
  return dbUser;
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, user.id),
  });
}

export async function getUsers() {
  const currentUser = await getCurrentUser();

  return db
    .select()
    .from(users)
    .where(eq(users.companyId, currentUser.companyId!))
    .orderBy(users.createdAt);
}

export async function getCompany() {
  const currentUser = await getCurrentUser();

  return db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.id, currentUser.companyId!),
  });
}

export async function updateCompany(data: {
  name?: string;
  address?: string;
  taxId?: string;
}) {
  const currentUser = await getCurrentUser();

  await db
    .update(companies)
    .set(data)
    .where(eq(companies.id, currentUser.companyId!));

  revalidatePath("/settings");
}

export async function inviteUser(data: {
  email: string;
  fullName: string;
  role: "owner" | "store_manager" | "store_employee" | "production_employee" | "accountant";
}) {
  const currentUser = await getCurrentUser();

  // Kreira korisnika u Supabase Auth i šalje pozivnicu
  const supabase = await createClient();
  const adminSupabase = (await import("@/lib/supabase/server")).createAdminClient();

  const { data: authUser, error } = await (await adminSupabase).auth.admin.inviteUserByEmail(data.email, {
    data: { full_name: data.fullName },
  });

  if (error) throw new Error(error.message);

  // Dodaj u users tabelu
  await db.insert(users).values({
    id: authUser.user.id,
    email: data.email,
    fullName: data.fullName,
    role: data.role,
    companyId: currentUser.companyId,
    isActive: true,
  });

  revalidatePath("/settings");
}
