"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, AlertTriangle, Clock, Package, Menu, CheckCircle2 } from "lucide-react";
import type { NotificationData } from "@/lib/actions/notifications";

export function AppHeader({ notifData, userName, onMenuClick }: { notifData: NotificationData; userName?: string; onMenuClick?: () => void }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { overdueOrders, openCorrections, inactiveCustomers, lowStockMaterials, materialReady } = notifData;

  const notifications = [
    ...materialReady.map((m) => ({
      id: `matready-${m.id}`,
      type: "success" as const,
      title: "Materijal stigao — nalog može u izradu",
      body: `${m.orderNumber} · ${m.material}`,
      sub: "Nalog čeka materijal koji je sada na stanju",
      href: `/orders/${m.id}`,
    })),
    ...overdueOrders.map((o) => ({
      id: `ord-${o.id}`,
      type: "warning" as const,
      title: "Nalog kasni",
      body: o.item ?? o.orderNumber,
      sub: `Rok bio: ${o.dueDate}`,
      href: `/orders/${o.id}`,
    })),
    ...openCorrections.map((c) => ({
      id: `cor-${c.id}`,
      type: "info" as const,
      title: "Otvorena korekcija",
      body: c.correctionType,
      sub: c.description.slice(0, 60),
      href: `/corrections`,
    })),
    ...inactiveCustomers.map((c) => ({
      id: `cust-${c.id}`,
      type: "neutral" as const,
      title: "Neaktivan klijent (90+ dana)",
      body: `${c.firstName} ${c.lastName}`,
      sub: `Poslednji dolazak: ${c.lastVisitDate ?? "—"}`,
      href: `/customers/${c.id}`,
    })),
    ...lowStockMaterials.map((m) => ({
      id: `stock-${m.id}`,
      type: "warning" as const,
      title: "Niske zalihe materijala",
      body: m.name,
      sub: `Slobodno: ${(Number(m.currentStock) - Number(m.reservedStock)).toFixed(1)} ${m.unit}`,
      href: `/inventory`,
    })),
  ];

  const count = notifications.length;

  const iconColor = {
    warning: "text-orange-500",
    info: "text-blue-500",
    neutral: "text-gray-400",
    success: "text-green-600",
  };

  const iconBg = {
    warning: "bg-orange-50",
    info: "bg-blue-50",
    neutral: "bg-gray-50",
    success: "bg-green-50",
  };

  const NotifIcon = {
    warning: AlertTriangle,
    info: Clock,
    neutral: Package,
    success: CheckCircle2,
  };

  return (
    <header className="h-14 border-b bg-white flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10">
      {/* Hamburger — samo na mobilnom */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex-1" />

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
        >
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-10 w-80 bg-white border rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold">Obaveštenja ({count})</span>
                <button onClick={() => setOpen(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Nema obaveštenja</div>
                ) : (
                  notifications.map((n) => {
                    const Icon = NotifIcon[n.type];
                    return (
                      <button
                        key={n.id}
                        onClick={() => { setOpen(false); router.push(n.href); }}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconBg[n.type]}`}>
                          <Icon className={`w-3.5 h-3.5 ${iconColor[n.type]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">{n.title}</p>
                          <p className="text-sm font-medium truncate">{n.body}</p>
                          <p className="text-xs text-muted-foreground">{n.sub}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-medium">
          {(userName ?? "MM").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium hidden sm:block">{userName ?? "Korisnik"}</span>
      </div>
    </header>
  );
}
