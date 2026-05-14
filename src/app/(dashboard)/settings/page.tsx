import { getUsers, getCompany } from "@/lib/actions/settings";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const [users, company] = await Promise.all([getUsers(), getCompany()]);
  return <SettingsClient users={users} company={company ?? null} />;
}
