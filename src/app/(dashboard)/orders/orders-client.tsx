"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { Order, Customer, OrderItem, Purchase } from "@/lib/db/schema";

// Nalog sa svime što lista prikazuje
type Nalog = Order & {
  customer: Customer | null;
  items: OrderItem[];
  purchase: Purchase | null;
};

const today = new Date().toISOString().split("T")[0];

function isOverdue(n: Nalog) {
  if (!n.dueDate) return false;
  if (n.nalogStatus === "preuzeto" || n.nalogStatus === "otkazano") return false;
  return n.dueDate < today;
}

// Plaćanje je na nivou porudžbine (avans pokriva celu porudžbinu).
// Za stare naloge bez porudžbine — padni na status samog naloga.
function paymentOf(n: Nalog): string {
  return n.purchase?.paymentStatus ?? n.paymentStatus ?? "unpaid";
}
function isPaid(n: Nalog) {
  return paymentOf(n) === "paid";
}

// ─── Tip naloga (Artikal kolona iz Aleksandrovog modela) ──────────────────────
const kindLabels: Record<string, string> = {
  domaca: "Domaća",
  munro: "Munro",
  gotov: "Gotov proizvod",
};
const kindColors: Record<string, string> = {
  domaca: "bg-blue-100 text-blue-800",
  munro: "bg-purple-100 text-purple-700",
  gotov: "bg-emerald-100 text-emerald-700",
};

// ─── Status naloga (tok kroz proizvodnju) ─────────────────────────────────────
const nalogStatusLabels: Record<string, string> = {
  naruceno: "Naručeno",
  ceka_materijal: "Čeka materijal",
  za_izradu: "Za izradu",
  izrada: "U izradi",
  gotovo: "Gotovo",
  u_radnji: "U radnji",
  preuzeto: "Preuzeto",
  korekcija: "Korekcija",
  otkazano: "Otkazano",
};
const nalogStatusColors: Record<string, string> = {
  naruceno: "bg-gray-100 text-gray-700",
  ceka_materijal: "bg-amber-100 text-amber-800",
  za_izradu: "bg-sky-100 text-sky-800",
  izrada: "bg-yellow-100 text-yellow-800",
  gotovo: "bg-green-100 text-green-800",
  u_radnji: "bg-teal-100 text-teal-800",
  preuzeto: "bg-gray-100 text-gray-500",
  korekcija: "bg-orange-100 text-orange-800",
  otkazano: "bg-red-100 text-red-700",
};

// Artikli iz stavki naloga (padni na staro polje `item` za stare naloge)
function artikliText(n: Nalog): string {
  if (n.items.length > 0) {
    const names = n.items.map((it) =>
      it.quantity && it.quantity > 1 ? `${it.artikal} ×${it.quantity}` : it.artikal
    );
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }
  return n.item ?? "—";
}

const PAGE_SIZE = 25;

export function OrdersClient({
  nalozi,
  initialFilter,
}: {
  nalozi: Nalog[];
  initialFilter?: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? "all");
  const [page, setPage] = useState(1);

  const allFiltered = nalozi
    .filter((n) => {
      const q = search.toLowerCase();
      const customer = n.customer;
      const matchSearch =
        !q ||
        n.orderNumber.toLowerCase().includes(q) ||
        (n.purchase?.purchaseNumber ?? "").toLowerCase().includes(q) ||
        (!!customer && `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(q)) ||
        artikliText(n).toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "overdue" ? isOverdue(n) :
        statusFilter === "unpaid" ? (!isPaid(n) && n.nalogStatus !== "otkazano") :
        n.nalogStatus === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      // Kasni nalozi uvek gore
      const aOverdue = isOverdue(a) ? 0 : 1;
      const bOverdue = isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      // Zatim po roku (bliži rok gore), bez roka na dno
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
  const filtered = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const overdueCount = nalozi.filter(isOverdue).length;
  const unpaidCount = nalozi.filter((n) => !isPaid(n) && n.nalogStatus !== "otkazano").length;
  const countBy = (status: string) => nalozi.filter((n) => n.nalogStatus === status).length;

  const tabs = [
    { key: "all", label: "Svi", count: nalozi.length },
    { key: "overdue", label: "Kasni", count: overdueCount },
    { key: "unpaid", label: "Neplaćeni", count: unpaidCount },
    { key: "naruceno", label: "Naručeno", count: countBy("naruceno") },
    { key: "ceka_materijal", label: "Čeka materijal", count: countBy("ceka_materijal") },
    { key: "za_izradu", label: "Za izradu", count: countBy("za_izradu") },
    { key: "izrada", label: "U izradi", count: countBy("izrada") },
    { key: "gotovo", label: "Gotovo", count: countBy("gotovo") },
    { key: "u_radnji", label: "U radnji", count: countBy("u_radnji") },
    { key: "preuzeto", label: "Preuzeto", count: countBy("preuzeto") },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nalozi</h1>
          <p className="text-muted-foreground text-sm mt-1">{nalozi.length} ukupno naloga</p>
        </div>
        <Link href="/orders/new"
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
          <Plus className="w-4 h-4" /> Nova porudžbina
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => {
          const isRedTab = tab.key === "overdue" || tab.key === "unpaid";
          const isActive = statusFilter === tab.key;
          return (
            <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap
                ${isActive
                  ? isRedTab ? "border-red-500 text-red-600" : "border-black text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {isRedTab && <AlertCircle className="w-3.5 h-3.5" />}
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full
                  ${isActive
                    ? isRedTab ? "bg-red-500 text-white" : "bg-black text-white"
                    : isRedTab && tab.count > 0 ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pretraži po klijentu, broju, artiklu..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nalog</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Klijent</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Tip</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Rok</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const customer = n.customer;
                return (
                  <tr key={n.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${n.id}`} className="text-sm font-mono font-medium hover:underline">
                        {n.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{artikliText(n)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {customer ? (
                        <Link href={`/customers/${customer.id}`} className="text-sm hover:underline">
                          {customer.firstName} {customer.lastName}
                        </Link>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${kindColors[n.orderKind] ?? "bg-muted"}`}>
                        {kindLabels[n.orderKind] ?? n.orderKind}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${nalogStatusColors[n.nalogStatus] ?? "bg-gray-100"}`}>
                        {nalogStatusLabels[n.nalogStatus] ?? n.nalogStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {n.dueDate ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm ${isOverdue(n) ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            {n.dueDate}
                          </span>
                          {isOverdue(n) && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Kasni</span>
                          )}
                        </div>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-medium">RSD {Number(n.totalAmount).toLocaleString()}</p>
                      <p className={`text-xs ${isPaid(n) ? "text-green-600" : paymentOf(n) === "avans" || paymentOf(n) === "partial" ? "text-orange-600" : "text-red-600"}`}>
                        {isPaid(n) ? "Plaćeno" : paymentOf(n) === "avans" || paymentOf(n) === "partial" ? "Avans uplaćen" : "Neplaćeno"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {search ? `Nema rezultata za "${search}"` : "Nema naloga. Kreiraj prvu porudžbinu!"}
            </div>
          )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allFiltered.length)} od {allFiltered.length}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded hover:bg-muted disabled:opacity-40 transition-colors">←</button>
                <span className="px-3 py-1">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 border rounded hover:bg-muted disabled:opacity-40 transition-colors">→</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
