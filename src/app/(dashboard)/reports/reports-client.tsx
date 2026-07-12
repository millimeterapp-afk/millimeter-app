"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Users, ClipboardList, Scissors } from "lucide-react";
import type { Order, Customer, Correction } from "@/lib/db/schema";

const COLORS = ["#18181b", "#52525b", "#a1a1aa", "#d4d4d8", "#e4e4e7"];

const statusLabels: Record<string, string> = {
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

const kindLabels: Record<string, string> = {
  domaca: "Domaća izrada",
  munro: "Munro",
  gotov: "Gotov proizvod",
};

const tierColors: Record<string, string> = {
  Platinum: "bg-purple-100 text-purple-800",
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-100 text-gray-700",
  Bronze: "bg-orange-100 text-orange-800",
};

export function ReportsClient({
  orders,
  customers,
  corrections,
}: {
  orders: Order[];
  customers: Customer[];
  corrections: Correction[];
}) {
  // Prihod po mesecima iz preuzetih (završenih) naloga
  const revenueByMonth: Record<string, number> = {};
  orders
    .filter((o) => o.nalogStatus === "preuzeto")
    .forEach((o) => {
      const month = new Date(o.createdAt).toLocaleString("sr-Latn", { month: "short", year: "2-digit" });
      revenueByMonth[month] = (revenueByMonth[month] ?? 0) + Number(o.totalAmount);
    });
  const chartData = Object.entries(revenueByMonth).map(([month, prihod]) => ({ month, prihod }));

  const totalRevenue = chartData.reduce((s, m) => s + m.prihod, 0);
  const avgMonthly = chartData.length > 0 ? Math.round(totalRevenue / chartData.length) : 0;
  const bestMonth = chartData.length > 0 ? chartData.reduce((a, b) => a.prihod > b.prihod ? a : b) : null;

  // Nalozi po statusu (faza izrade)
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.nalogStatus] = (acc[o.nalogStatus] ?? 0) + 1;
    return acc;
  }, {});
  const ordersByStatus = Object.entries(statusCounts)
    .map(([status, value]) => ({ name: statusLabels[status] ?? status, value, status }))
    .filter((o) => o.value > 0)
    .sort((a, b) => b.value - a.value);

  // Nalozi po tipu (Artikal: domaća / munro / gotov)
  const typeCounts = orders.reduce<Record<string, number>>((acc, o) => {
    const label = kindLabels[o.orderKind] ?? o.orderKind;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const ordersByType = Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value }))
    .filter((o) => o.value > 0);

  // Top klijenti
  const topCustomers = [...customers]
    .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
    .slice(0, 5);
  const maxSpent = Number(topCustomers[0]?.totalSpent ?? 1);

  // Korekcije po tipu
  const correctionCounts = corrections.reduce<Record<string, number>>((acc, c) => {
    acc[c.correctionType] = (acc[c.correctionType] ?? 0) + 1;
    return acc;
  }, {});
  const correctionData = Object.entries(correctionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Lojalnost
  const loyaltyBreakdown = ["Platinum", "Gold", "Silver", "Bronze"].map((tier) => ({
    tier,
    count: customers.filter((c) => c.loyaltyTier === tier).length,
    color: tierColors[tier],
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Izveštaji</h1>
        <p className="text-muted-foreground text-sm mt-1">Finansijski i poslovni pregled — stvarni podaci</p>
      </div>

      {/* KPI kartice */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Ukupan prihod", value: `RSD ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "bg-black text-white" },
          { label: "Prosek / mesec", value: `RSD ${avgMonthly.toLocaleString()}`, icon: TrendingUp, color: "bg-blue-100 text-blue-700" },
          { label: "Ukupno klijenata", value: String(customers.length), icon: Users, color: "bg-green-100 text-green-700" },
          { label: "Ukupno naloga", value: String(orders.length), icon: ClipboardList, color: "bg-yellow-100 text-yellow-700" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${s.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Graf prihoda + Pie tip naloga */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Prihod po mesecima (preuzeti nalozi)</CardTitle>
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
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                Nema preuzetih naloga još
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nalozi po tipu</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ordersByType} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {ordersByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                Nema naloga
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Donji red */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top klijenti */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Top klijenti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCustomers.length > 0 ? topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className="bg-black h-1.5 rounded-full"
                      style={{ width: `${(Number(c.totalSpent) / maxSpent) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold shrink-0">RSD {Number(c.totalSpent).toLocaleString()}</span>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Nema klijenata</p>
            )}
          </CardContent>
        </Card>

        {/* Nalozi po statusu */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Nalozi po statusu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ordersByStatus.length > 0 ? ordersByStatus.map((o) => (
              <div key={o.status} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{o.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-muted rounded-full h-1.5">
                    <div
                      className="bg-black h-1.5 rounded-full"
                      style={{ width: `${orders.length > 0 ? (o.value / orders.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-medium w-4 text-right">{o.value}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Nema naloga</p>
            )}
          </CardContent>
        </Card>

        {/* Korekcije + Lojalnost */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="w-4 h-4" /> Korekcije po tipu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {correctionData.length > 0 ? correctionData.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">{d.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 bg-muted rounded-full h-1.5">
                    <div
                      className="bg-black h-1.5 rounded-full"
                      style={{ width: `${corrections.length > 0 ? (d.value / corrections.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-medium w-4 text-right">{d.value}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Nema korekcija</p>
            )}

            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lojalnost</p>
              {loyaltyBreakdown.filter((l) => l.count > 0).map((l) => (
                <div key={l.tier} className="flex items-center justify-between text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.color}`}>{l.tier}</span>
                  <span className="font-medium">{l.count} klijenata</span>
                </div>
              ))}
              {loyaltyBreakdown.every((l) => l.count === 0) && (
                <p className="text-sm text-muted-foreground">Nema klijenata</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Najbolji mesec */}
      {bestMonth && (
        <Card className="bg-black text-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Najbolji mesec</p>
                <p className="text-3xl font-bold mt-1">RSD {bestMonth.prihod.toLocaleString()}</p>
                <p className="text-zinc-400 text-sm mt-1">{bestMonth.month}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-zinc-600" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
