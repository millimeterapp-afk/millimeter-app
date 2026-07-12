"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateNalogStatus } from "@/lib/actions/purchases";
import { updateCorrectionStatus } from "@/lib/actions/corrections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Wrench, AlertCircle } from "lucide-react";
import type { Order, Customer, OrderItem, Correction } from "@/lib/db/schema";

type Nalog = Order & { customer: Customer | null; items: OrderItem[] };
type CorrectionWithDetails = Correction & { order: Order | null; customer: Customer | null };

// Tok kroz radionicu (Aleksandrov "Stanje materijala")
const FLOW = ["naruceno", "ceka_materijal", "za_izradu", "izrada", "gotovo", "u_radnji", "preuzeto"] as const;
type NalogStatus = (typeof FLOW)[number] | "korekcija" | "otkazano";

function nextOf(s: string): NalogStatus | null {
  const i = FLOW.indexOf(s as (typeof FLOW)[number]);
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null;
}

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

// Kolone table = faze osim "preuzeto" (preuzet nalog izlazi sa table)
const columns = [
  { id: "naruceno", bg: "bg-gray-50", accent: "text-gray-500" },
  { id: "ceka_materijal", bg: "bg-amber-50", accent: "text-amber-600" },
  { id: "za_izradu", bg: "bg-sky-50", accent: "text-sky-600" },
  { id: "izrada", bg: "bg-yellow-50", accent: "text-yellow-600" },
  { id: "gotovo", bg: "bg-green-50", accent: "text-green-600" },
  { id: "u_radnji", bg: "bg-teal-50", accent: "text-teal-600" },
] as const;

const kindLabels: Record<string, string> = {
  domaca: "Domaća",
  munro: "Munro",
  gotov: "Gotov",
};
const kindColors: Record<string, string> = {
  domaca: "bg-blue-100 text-blue-800",
  munro: "bg-purple-100 text-purple-700",
  gotov: "bg-emerald-100 text-emerald-700",
};

const today = new Date().toISOString().split("T")[0];

function artikliText(n: Nalog): string {
  if (n.items.length > 0) {
    const names = n.items.map((it) => (it.quantity && it.quantity > 1 ? `${it.artikal} ×${it.quantity}` : it.artikal));
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }
  return n.item ?? "Nalog";
}

export function ProductionClient({
  nalozi,
  productionCorrections,
}: {
  nalozi: Nalog[];
  productionCorrections: CorrectionWithDetails[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const advance = (nalogId: string, status: NalogStatus) => {
    startTransition(async () => {
      await updateNalogStatus(nalogId, status);
      router.refresh();
    });
  };

  const resolveCorrection = (correctionId: string, resolved: boolean) => {
    startTransition(async () => {
      await updateCorrectionStatus(correctionId, resolved ? "resolved" : "not_resolved");
      router.refresh();
    });
  };

  const korekcije = nalozi.filter((n) => n.nalogStatus === "korekcija");

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Produkcija</h1>
        <p className="text-muted-foreground text-sm mt-1">Praćenje faze izrade za svaki nalog</p>
      </div>

      {/* Nalozi u korekciji */}
      {korekcije.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-orange-500" /> Nalozi u korekciji
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium ml-1">{korekcije.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {korekcije.map((n) => (
              <div key={n.id} className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                <Link href={`/orders/${n.id}`} className="text-sm font-medium hover:underline">{artikliText(n)}</Link>
                <span className="text-xs text-muted-foreground">{n.customer ? `${n.customer.firstName} ${n.customer.lastName}` : ""}</span>
                <button onClick={() => advance(n.id, "izrada")} disabled={isPending}
                  className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 font-medium disabled:opacity-50">
                  Vrati u izradu →
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Kolone po fazi */}
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-6 gap-3 min-w-[1100px] items-start">
          {columns.map((col) => {
            const colNalozi = nalozi.filter((n) => n.nalogStatus === col.id);
            const next = nextOf(col.id);
            return (
              <div key={col.id} className="space-y-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${col.bg}`}>
                  <span className={`text-sm font-medium ${col.accent}`}>{statusLabels[col.id]}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                    {colNalozi.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-24">
                  {colNalozi.map((n) => {
                    const overdue = n.dueDate && n.dueDate < today;
                    return (
                      <Card key={n.id} className="shadow-none hover:shadow-sm transition-shadow">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/orders/${n.id}`} className="text-sm font-medium leading-tight hover:underline">
                              {artikliText(n)}
                            </Link>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${kindColors[n.orderKind] ?? "bg-muted"}`}>
                              {kindLabels[n.orderKind] ?? n.orderKind}
                            </span>
                          </div>
                          {n.customer && (
                            <p className="text-xs text-muted-foreground">{n.customer.firstName} {n.customer.lastName}</p>
                          )}
                          {n.notes && (
                            <p className="text-xs italic text-muted-foreground border-l-2 pl-2">{n.notes}</p>
                          )}
                          <div className={`flex items-center text-xs pt-1 border-t ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            <Clock className="w-3 h-3 mr-1" />
                            {n.dueDate ?? "Bez roka"}
                            {overdue && <span className="ml-1.5 bg-red-100 text-red-600 px-1.5 rounded-full">Kasni</span>}
                          </div>
                          {next && (
                            <button onClick={() => advance(n.id, next)} disabled={isPending}
                              className="w-full text-xs bg-black text-white px-2 py-1.5 rounded hover:bg-black/80 font-medium disabled:opacity-50">
                              {next === "preuzeto" ? "Preuzeto ✓" : `→ ${statusLabels[next]}`}
                            </button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {colNalozi.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg h-20 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">—</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Korekcije (iz tabele korekcija) */}
      {productionCorrections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Korekcije u produkciji
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium ml-1">
                {productionCorrections.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productionCorrections.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-4 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded font-medium">{c.correctionType}</span>
                    {c.customer && (
                      <span className="text-xs text-muted-foreground">{c.customer.firstName} {c.customer.lastName}</span>
                    )}
                    {c.dueDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {c.dueDate}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{c.description}</p>
                  {c.cause && <p className="text-xs text-muted-foreground mt-0.5">{c.cause}</p>}
                  {c.order && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{c.order.orderNumber} — {c.order.item ?? "—"}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resolveCorrection(c.id, true)} disabled={isPending}
                    className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded hover:bg-green-200 font-medium disabled:opacity-50">
                    Rešeno ✓
                  </button>
                  <button onClick={() => resolveCorrection(c.id, false)} disabled={isPending}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 font-medium disabled:opacity-50">
                    Nije rešeno
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
