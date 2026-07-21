"use server";

import { db } from "@/lib/db";
import { users, companies } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/server";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";

async function getCurrentUser() {
  const { dbUser } = await requireActiveUser();
  return dbUser;
}

export async function getCurrentProfile() {
  // Vraća profil samo za prijavljenog i AKTIVNog korisnika; inače null.
  try {
    const { dbUser } = await requireActiveUser();
    return dbUser;
  } catch {
    return null;
  }
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
  if (currentUser.role !== "owner") throw new Error("Samo vlasnik može dodavati korisnike");

  const adminSupabase = await createAdminClient();

  const { data: authUser, error } = await adminSupabase.auth.admin.inviteUserByEmail(data.email, {
    data: { full_name: data.fullName },
  });

  if (error) throw new Error(error.message);

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

export async function createUserWithPassword(data: {
  email: string;
  fullName: string;
  role: "owner" | "store_manager" | "store_employee" | "production_employee" | "accountant";
  password: string;
}) {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "owner") throw new Error("Samo vlasnik može dodavati korisnike");

  const adminSupabase = await createAdminClient();

  const { data: authUser, error } = await adminSupabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.fullName },
  });

  if (error) throw new Error(error.message);

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

export async function updateUserRole(
  userId: string,
  role: "owner" | "store_manager" | "store_employee" | "production_employee" | "accountant"
) {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "owner") throw new Error("Samo vlasnik može menjati uloge");

  await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, userId), eq(users.companyId, currentUser.companyId!)));

  revalidatePath("/settings");
}

export async function toggleUserActive(userId: string) {
  const currentUser = await getCurrentUser();
  if (currentUser.role !== "owner") throw new Error("Samo vlasnik može deaktivirati korisnike");
  if (userId === currentUser.id) throw new Error("Ne možeš deaktivirati vlastiti nalog");

  const target = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
  if (!target) throw new Error("Korisnik nije pronađen");

  await db
    .update(users)
    .set({ isActive: !target.isActive })
    .where(and(eq(users.id, userId), eq(users.companyId, currentUser.companyId!)));

  revalidatePath("/settings");
}
