import { DashboardShell } from "@/components/dashboard-shell";
import { getNotificationData } from "@/lib/actions/notifications";
import { getCurrentProfile } from "@/lib/actions/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [notifData, profile] = await Promise.all([getNotificationData(), getCurrentProfile()]);

  return (
    <DashboardShell
      notifData={notifData}
      userName={profile?.fullName ?? "Korisnik"}
      userEmail={profile?.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
