"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTopMunroByYear } from "@/lib/actions/customers";
import { Package } from "lucide-react";
import Link from "next/link";

type Row = { customerId: string | null; customerName: string; orders: number; totalEur: number };

export function MunroTopByYear({ years }: { years: number[] }) {
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => setRows(await getTopMunroByYear(year)));
  }, [year]);

  const max = rows[0]?.totalEur || 1;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" /> Top klijenti — Munro porudžbine
        </CardTitle>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && <p className="text-sm text-muted-foreground py-4 text-center">Učitavanje...</p>}
        {!isPending && rows.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nema Munro porudžbina za {year}.</p>}
        {!isPending && rows.map((r, i) => (
          <div key={(r.customerId ?? "") + r.customerName} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              {r.customerId ? (
                <Link href={`/customers/${r.customerId}`} className="text-sm font-medium truncate hover:underline">{r.customerName}</Link>
              ) : (
                <span className="text-sm font-medium truncate">{r.customerName}</span>
              )}
              <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                <div className="bg-black h-1.5 rounded-full" style={{ width: `${(r.totalEur / max) * 100}%` }} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">€{Math.round(r.totalEur).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{r.orders} porudžbina</p>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground pt-2 border-t">Iznosi su Munro veleprodajne cene (P_Price), pokazatelj obima — ne maloprodajni prihod.</p>
      </CardContent>
    </Card>
  );
}
