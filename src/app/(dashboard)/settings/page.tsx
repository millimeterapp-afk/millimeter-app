import { getUsers, getCompany, getCurrentProfile } from "@/lib/actions/settings";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
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
