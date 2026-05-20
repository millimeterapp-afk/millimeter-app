"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { Order, Customer } from "@/lib/db/schema";

const today = new Date().toISOString().split("T")[0];

function isOverdue(order: Order) {
  if (!order.dueDate) return false;
  if (order.status === "delivered" || order.status === "cancelled") return false;
  return order.dueDate < today;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-800",
  in_production: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  confirmed: "Potvrđen",
  in_production: "U produkciji",
  ready: "Gotov",
  delivered: "Isporučen",
  cancelled: "Otkazano",
};

const typeLabels: Record<string, string> = {
  custom: "Po meri",
  ready_made: "Gotova roba",
  correction: "Korekcija",
};

const PAGE_SIZE = 25;

export function OrdersClient({
  orders, customers, initialFilter,
}: {
  orders: Order[];
  customers: Customer[];
  initialFilter?: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilter ?? "all");
  const [page, setPage] = useState(1);

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  const allFiltered = orders
    .filter((o) => {
      const customer = o.customerId ? customerMap[o.customerId] : null;
      const matchSearch =
        o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        (customer && `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(search.toLowerCase())) ||
        (o.item ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "overdue" ? isOverdue(o) :
        statusFilter === "unpaid" ? (o.paymentStatus !== "paid" && o.status !== "cancelled") :
        o.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      // Kasni nalozi uvijek gore
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

  const overdueCount = orders.filter(isOverdue).length;

  const unpaidCount = orders.filter(o => o.paymentStatus !== "paid" && o.status !== "cancelled").length;

  const tabs = [
    { key: "all", label: "Svi", count: orders.length },
    { key: "overdue", label: "Kasni", count: overdueCount },
    { key: "unpaid", label: "Neplaćeni", count: unpaidCount },
    { key: "draft", label: "Nacrt", count: orders.filter(o => o.status === "draft").length },
    { key: "confirmed", label: "Potvrđeni", count: orders.filter(o => o.status === "confirmed").length },
    { key: "in_production", label: "U produkciji", count: orders.filter(o => o.status === "in_production").length },
    { key: "ready", label: "Gotovi", count: orders.filter(o => o.status === "ready").length },
    { key: "delivered", label: "Isporučeni", count: orders.filter(o => o.status === "delivered").length },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nalozi</h1>
          <p className="text-muted-foreground text-sm mt-1">{orders.length} ukupno naloga</p>
        </div>
        <Link href="/orders/new"
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
          <Plus className="w-4 h-4" /> Novi nalog
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
        <Input placeholder="Pretraži po klijentu, broju..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
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
              {filtered.map((order) => {
                const customer = order.customerId ? customerMap[order.customerId] : null;
                return (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="text-sm font-mono font-medium hover:underline">
                        {order.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.item ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {customer ? (
                        <Link href={`/customers/${customer.id}`} className="text-sm hover:underline">
                          {customer.firstName} {customer.lastName}
                        </Link>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{typeLabels[order.orderType] ?? order.orderType}</span>
                        {(order as Order & { productionFlow?: string }).productionFlow === "munro" && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">Munro</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] ?? "bg-gray-100"}`}>
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.dueDate ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm ${isOverdue(order) ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            {order.dueDate}
                          </span>
                          {isOverdue(order) && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Kasni</span>
                          )}
                        </div>
                      ) : <span className="text-sm text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-medium">RSD {Number(order.totalAmount).toLocaleString()}</p>
                      <p className={`text-xs ${order.paymentStatus === "paid" ? "text-green-600" : "text-orange-600"}`}>
                        {order.paymentStatus === "paid" ? "Plaćeno" : order.paymentStatus === "partial" ? "Djelimično" : "Neplaćeno"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {search ? `Nema rezultata za "${search}"` : "Nema naloga. Kreiraj prvi nalog!"}
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
