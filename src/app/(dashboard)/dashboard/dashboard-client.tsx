"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, ClipboardList, AlertCircle, Scissors, CheckCircle2, ArrowUpRight, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";
import type { Order, Customer, ProductionTask, Correction, Appointment } from "@/lib/db/schema";

const statusColors: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  in_production: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, string> = {
  confirmed: "Potvrđen",
  in_production: "U produkciji",
  ready: "Gotov",
  delivered: "Isporučen",
};

const now = new Date();
const monthName = now.toLocaleString("sr-Latn", { month: "long", year: "numeric" });

type AppointmentWithCustomer = Appointment & { customer: Customer | null };

const typeLabels: Record<string, string> = {
  merenje: "Merenje", proba: "Proba", isporuka: "Isporuka",
  konsultacija: "Konsultacija", ostalo: "Ostalo",
};

export function DashboardClient({
  orders, customers, tasks, corrections, todayAppointments,
}: {
  orders: Order[];
  customers: Customer[];
  tasks: { status: string }[];
  corrections: Correction[];
  todayAppointments: AppointmentWithCustomer[];
}) {
  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
  const inProduction = orders.filter(o => o.status === "in_production");
  const unpaidOrders = orders.filter(o => o.paymentStatus !== "paid" && o.status !== "cancelled");
  const unpaidAmount = unpaidOrders.reduce((sum, o) => sum + Number(o.totalAmount) - Number(o.paidAmount), 0);
  const deliveredCount = orders.filter(o => o.status === "delivered").length;

  const topCustomers = [...customers]
    .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
    .slice(0, 3);

  // Revenue by month from real orders
  const revenueByMonth: Record<string, number> = {};
  orders.filter(o => o.status === "delivered").forEach(o => {
    const month = new Date(o.createdAt).toLocaleString("sr-Latn", { month: "short" });
    revenueByMonth[month] = (revenueByMonth[month] ?? 0) + Number(o.totalAmount);
  });
  const chartData = Object.entries(revenueByMonth).map(([month, prihod]) => ({ month, prihod }));

  const thisMonthRevenue = orders
    .filter(o => {
      const d = new Date(o.createdAt);
      return o.status === "delivered" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Pregled poslovanja — {monthName}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/reports">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Prihod ovog meseca</p>
                  <p className="text-2xl font-bold mt-1">RSD {thisMonthRevenue.toLocaleString()}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><ArrowUpRight className="w-3 h-3" />iz baze</p>
                </div>
                <div className="w-9 h-9 bg-black rounded-md flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/orders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktivni nalozi</p>
                  <p className="text-2xl font-bold mt-1">{activeOrders.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{inProduction.length} u produkciji</p>
                </div>
                <div className="w-9 h-9 bg-yellow-100 rounded-md flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4 text-yellow-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/orders?filter=unpaid">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Nenaplaćeno</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">RSD {Math.round(unpaidAmount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{unpaidOrders.length} otvorenih</p>
                </div>
                <div className="w-9 h-9 bg-red-100 rounded-md flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/customers">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Klijenti ukupno</p>
                  <p className="text-2xl font-bold mt-1">{customers.length}</p>
                  <p className="text-xs text-green-600 mt-1">
                    +{customers.filter(c => {
                      const d = new Date(c.createdAt);
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }).length} ovaj mesec
                  </p>
                </div>
                <div className="w-9 h-9 bg-blue-100 rounded-md flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Prihod po mesecima</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`RSD ${v}`, "Prihod"]} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="prihod" fill="#18181b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Nema isporučenih naloga još uvijek
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Aktivni nalozi</CardTitle>
            <Link href="/orders" className="text-xs text-muted-foreground hover:underline">Svi →</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeOrders.slice(0, 4).map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.item ?? "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColors[order.status] ?? "bg-gray-100"}`}>
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </div>
              </Link>
            ))}
            {activeOrders.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nema aktivnih naloga</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link href="/production">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Scissors className="w-4 h-4" />Produkcija</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "U radu", value: tasks.filter(t => t.status === "in_progress").length },
                { label: "Čeka na red", value: tasks.filter(t => t.status === "queued").length },
                { label: "Gotovi", value: tasks.filter(t => t.status === "done").length },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium">{s.value} naloga</span>
                </div>
              ))}
              <div className="text-center text-xs text-muted-foreground mt-3 pt-3 border-t">
                Otvori produkciju →
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Pregled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/orders?filter=delivered" className="flex justify-between text-sm hover:underline">
              <span className="text-muted-foreground">Isporučenih naloga</span>
              <span className="font-medium">{deliveredCount}</span>
            </Link>
            <Link href="/corrections" className="flex justify-between text-sm hover:underline">
              <span className="text-muted-foreground">Otvorenih korekcija</span>
              <span className="font-medium text-orange-600">{corrections.filter(c => c.status === "open").length}</span>
            </Link>
            <Link href="/customers" className="flex justify-between text-sm hover:underline">
              <span className="text-muted-foreground">Ukupno klijenata</span>
              <span className="font-medium">{customers.length}</span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />Top klijenti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCustomers.length > 0 ? topCustomers.map((c) => (
              <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center justify-between text-sm hover:underline">
                <span className="text-muted-foreground truncate">{c.firstName} {c.lastName}</span>
                <span className="font-medium shrink-0">RSD {Number(c.totalSpent).toLocaleString()}</span>
              </Link>
            )) : (
              <p className="text-sm text-muted-foreground">Nema klijenata još</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Termini danas */}
      <Link href="/appointments">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Termini danas
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {todayAppointments.filter(a => a.status === "scheduled").length} zakazana
            </span>
          </CardHeader>
          <CardContent>
            {todayAppointments.filter(a => a.status === "scheduled").length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nema zakazanih termina danas</p>
            ) : (
              <div className="space-y-2">
                {todayAppointments
                  .filter(a => a.status === "scheduled")
                  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                  .map(appt => {
                    const dt = new Date(appt.scheduledAt);
                    const time = dt.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={appt.id} className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0 w-12">
                          <Clock className="w-3 h-3" />{time}
                        </div>
                        <span className="font-medium truncate">
                          {appt.customer
                            ? `${appt.customer.firstName} ${appt.customer.lastName}`
                            : "Bez klijenta"}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {typeLabels[appt.type] ?? appt.type}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
