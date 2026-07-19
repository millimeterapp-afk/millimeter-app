"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, ClipboardList, AlertCircle, Scissors, CheckCircle2, ArrowUpRight, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";
import type { Order, Customer, OrderItem, Purchase, Correction, Appointment } from "@/lib/db/schema";

type Nalog = Order & {
  customer: Customer | null;
  items: OrderItem[];
  purchase: Purchase | null;
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

function artikliText(n: Nalog): string {
  if (n.items.length > 0) {
    const names = n.items.map((it) => (it.quantity && it.quantity > 1 ? `${it.artikal} ×${it.quantity}` : it.artikal));
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }
  return n.item ?? "—";
}

const now = new Date();
const monthName = now.toLocaleString("sr-Latn", { month: "long", year: "numeric" });

type AppointmentWithCustomer = Appointment & { customer: Customer | null };

const typeLabels: Record<string, string> = {
  merenje: "Merenje", proba: "Proba", isporuka: "Isporuka",
  konsultacija: "Konsultacija", ostalo: "Ostalo",
};

interface CustomerStats {
  total: number;
  newThisMonth: number;
  top: { id: string; firstName: string; lastName: string; totalSpent: string }[];
  loyalty: Record<string, number>;
}

export function DashboardClient({
  nalozi, payments, customerStats, corrections, todayAppointments,
}: {
  nalozi: Nalog[];
  payments: { amount: string; paymentDate: string }[];
  customerStats: CustomerStats;
  corrections: Correction[];
  todayAppointments: AppointmentWithCustomer[];
}) {
  const activeNalozi = nalozi.filter((n) => !["preuzeto", "otkazano"].includes(n.nalogStatus));
  const inIzrada = nalozi.filter((n) => n.nalogStatus === "izrada");
  const preuzetoCount = nalozi.filter((n) => n.nalogStatus === "preuzeto").length;

  // Nenaplaćeno: avans/plaćanje se vodi na nivou porudžbine — dedupliramo porudžbine
  // da ne bismo brojali isti ostatak više puta (svadba = 1 porudžbina, više naloga).
  const seenPurchases = new Set<string>();
  let unpaidAmount = 0;
  let unpaidCount = 0;
  for (const n of nalozi) {
    if (n.nalogStatus === "otkazano") continue;
    if (n.purchase) {
      if (seenPurchases.has(n.purchase.id)) continue;
      seenPurchases.add(n.purchase.id);
      const rem = Number(n.purchase.totalAmount) - Number(n.purchase.paidAmount);
      if (rem > 0.005) { unpaidAmount += rem; unpaidCount++; }
    } else {
      const rem = Number(n.totalAmount) - Number(n.paidAmount);
      if (n.paymentStatus !== "paid" && rem > 0.005) { unpaidAmount += rem; unpaidCount++; }
    }
  }

  // Naplata: iz tabele uplata, po DATUMU KAD JE NOVAC LEGAO (avans i doplata mogu
  // biti u različitim mjesecima). Redoslijed mjeseci hronološki.
  const revByKey: Record<string, { label: string; sort: string; amount: number }> = {};
  let thisMonthRevenue = 0;
  for (const p of payments) {
    const amount = Number(p.amount);
    if (!(amount > 0)) continue;
    const d = new Date(p.paymentDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!revByKey[key]) revByKey[key] = { label: d.toLocaleString("sr-Latn", { month: "short" }), sort: key, amount: 0 };
    revByKey[key].amount += amount;
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) thisMonthRevenue += amount;
  }
  const chartData = Object.values(revByKey)
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map((r) => ({ month: r.label, prihod: r.amount }));

  const topCustomers = customerStats.top.slice(0, 3);

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
                  <p className="text-sm text-muted-foreground">Naplaćeno ovog meseca</p>
                  <p className="text-2xl font-bold mt-1">RSD {Math.round(thisMonthRevenue).toLocaleString()}</p>
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
                  <p className="text-2xl font-bold mt-1">{activeNalozi.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">{inIzrada.length} u izradi</p>
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
                  <p className="text-xs text-muted-foreground mt-1">{unpaidCount} porudžbina</p>
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
                  <p className="text-2xl font-bold mt-1">{customerStats.total}</p>
                  <p className="text-xs text-green-600 mt-1">+{customerStats.newThisMonth} ovaj mesec</p>
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
            <CardTitle className="text-base">Naplata po mesecima</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`RSD ${v}`, "Naplaćeno"]} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="prihod" fill="#18181b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Još nema evidentiranih uplata
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
            {activeNalozi.slice(0, 4).map((n) => (
              <Link key={n.id} href={`/orders/${n.id}`}>
                <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Scissors className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{artikliText(n)}</p>
                    <p className="text-xs text-muted-foreground truncate font-mono">{n.orderNumber}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${nalogStatusColors[n.nalogStatus] ?? "bg-gray-100"}`}>
                    {nalogStatusLabels[n.nalogStatus] ?? n.nalogStatus}
                  </span>
                </div>
              </Link>
            ))}
            {activeNalozi.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nema aktivnih naloga</p>}
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
                { label: "U izradi", value: nalozi.filter(n => n.nalogStatus === "izrada").length },
                { label: "Čeka (naručeno / materijal / za izradu)", value: nalozi.filter(n => ["naruceno", "ceka_materijal", "za_izradu"].includes(n.nalogStatus)).length },
                { label: "Gotovo / u radnji", value: nalozi.filter(n => ["gotovo", "u_radnji"].includes(n.nalogStatus)).length },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium shrink-0 ml-2">{s.value}</span>
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
            <Link href="/orders?filter=preuzeto" className="flex justify-between text-sm hover:underline">
              <span className="text-muted-foreground">Preuzetih naloga</span>
              <span className="font-medium">{preuzetoCount}</span>
            </Link>
            <Link href="/corrections" className="flex justify-between text-sm hover:underline">
              <span className="text-muted-foreground">Otvorenih korekcija</span>
              <span className="font-medium text-orange-600">{corrections.filter(c => c.status === "open").length}</span>
            </Link>
            <Link href="/customers" className="flex justify-between text-sm hover:underline">
              <span className="text-muted-foreground">Ukupno klijenata</span>
              <span className="font-medium">{customerStats.total}</span>
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
