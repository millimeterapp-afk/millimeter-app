import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { getNotificationData } from "@/lib/actions/notifications";
import { getCurrentProfile } from "@/lib/actions/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [notifData, profile] = await Promise.all([getNotificationData(), getCurrentProfile()]);

  return (
    <div className="flex h-screen bg-muted/30">
      <AppSidebar userName={profile?.fullName ?? "Korisnik"} userEmail={profile?.email ?? ""} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader notifData={notifData} userName={profile?.fullName ?? "Korisnik"} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
