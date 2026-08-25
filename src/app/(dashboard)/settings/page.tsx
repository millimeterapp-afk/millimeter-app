import { getUsers, getCompany, getCurrentProfile } from "@/lib/actions/settings";
import { SettingsClient } from "./settings-client";
import { guardSection } from "@/lib/access-guard";

export default async function SettingsPage() {
  await guardSection("/settings");
  const [users, company, profile] = await Promise.all([
    getUsers(),
    getCompany(),
    getCurrentProfile(),
  ]);

  return (
    <SettingsClient
      users={users}
      company={company ?? null}
      currentUserId={profile?.id ?? ""}
      currentUserRole={profile?.role ?? "store_employee"}
    />
  );
}
