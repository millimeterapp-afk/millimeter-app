"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Scissors,
  Package,
  TrendingUp,
  Settings,
  Building2,
  ShoppingCart,
  Wrench,
  LogOut,
  Truck,
  CalendarDays,
  ScanBarcode,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Klijenti", href: "/customers", icon: Users },
  { label: "Termini", href: "/appointments", icon: CalendarDays },
  { label: "Nalozi", href: "/orders", icon: ClipboardList },
  { label: "Produkcija", href: "/production", icon: Scissors },
  { label: "Korekcije", href: "/corrections", icon: Wrench },
  { label: "Zalihe", href: "/inventory", icon: Package },
  { label: "Barkodovi", href: "/barcodes", icon: ScanBarcode },
  { label: "Prodaja", href: "/sales", icon: ShoppingCart },
  { label: "Dobavljači", href: "/suppliers", icon: Truck },
  { label: "Izveštaji", href: "/reports", icon: TrendingUp },
];

const bottomItems = [
  { label: "Kompanije", href: "/companies", icon: Building2 },
  { label: "Podešavanja", href: "/settings", icon: Settings },
];

export function AppSidebar({
  userName,
  userEmail,
  onClose,
}: {
  userName?: string;
  userEmail?: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleNavClick = () => {
    onClose?.();
  };

  return (
    <aside className="w-60 shrink-0 border-r bg-white flex flex-col h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">MM</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Millimeter</p>
            <p className="text-xs text-muted-foreground mt-0.5">Srbija</p>
          </div>
        </div>
        {/* X dugme — samo na mobilnom */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-black text-white font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-black text-white font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* User + Logout */}
        <div className="flex items-center gap-3 px-3 py-2 mt-2">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
            {(userName ?? "K").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{userName ?? "Korisnik"}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail ?? ""}</p>
          </div>
          <button onClick={handleLogout} title="Odjavi se" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
