"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CustomerPicker } from "@/components/customer-picker";
import { searchCatalog } from "@/lib/actions/inventory";
import { createFinishedGoodsOrder } from "@/lib/actions/finished-goods";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Check, Package, X, ShoppingBag } from "lucide-react";

type CatalogItem = { id: string; name: string; sku: string | null; category: string | null; salePrice: string | null };
const payments = [
  { id: "cash" as const, label: "Gotovina" },
  { id: "card" as const, label: "Kartica" },
  { id: "transfer" as const, label: "Transfer" },
];

export function GotovProizvodClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<{ id: string; label: string } | null>(null);
  const [artQuery, setArtQuery] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [, startSearch] = useTransition();
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [price, setPrice] = useState("");
  const [payment, setPayment] = useState<"cash" | "card" | "transfer">("cash");
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const q = artQuery.trim();
    if (!q || selected) return;
    const t = setTimeout(() => { startSearch(async () => setResults(await searchCatalog(q))); }, 300);
    return () => clearTimeout(t);
  }, [artQuery, selected]);

  const pickArticle = (it: CatalogItem) => {
    setSelected(it);
    setArtQuery(it.name);
    setResults([]);
    setPrice(it.salePrice ? String(Math.round(Number(it.salePrice))) : "");
  };
  const resetArticle = () => { setSelected(null); setArtQuery(""); setPrice(""); setResults([]); };
  const toggleCorrection = (v: boolean) => { setNeedsCorrection(v); setPaid(!v); };

  const submit = () => {
    setError("");
    if (!customer) { setError("Izaberi klijenta."); return; }
    if (!artQuery.trim()) { setError("Izaberi ili upiši artikal."); return; }
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) { setError("Cena mora biti broj ≥ 0."); return; }
    startTransition(async () => {
      try {
        await createFinishedGoodsOrder({
          customerId: customer.id,
          articleName: artQuery.trim(),
          price: p,
          paymentMethod: payment,
          paid,
          needsCorrection,
          correctionNote: needsCorrection ? correctionNote : undefined,
          inventoryItemId: selected?.id,
        });
        setSuccess(true);
        setCustomer(null); resetArticle(); setPayment("cash"); setNeedsCorrection(false); setCorrectionNote(""); setPaid(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 2500);
      } catch (e) { setError(e instanceof Error ? e.message : "Greška pri kreiranju naloga."); }
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingBag className="w-6 h-6" /> Nalog za gotov proizvod</h1>
        <p className="text-sm text-muted-foreground mt-1">Klijent, artikal iz kataloga i opciona korekcija. Ne dira zalihe.</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2 rounded-md flex items-center gap-2">
          <Check className="w-4 h-4" /> Nalog je kreiran.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Podaci</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Klijent *</label>
            <div className="mt-1">
              <CustomerPicker value={customer} onChange={setCustomer} placeholder="Pretraži klijenta po imenu ili broju..." />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Artikal *</label>
            {selected ? (
              <div className="mt-1 flex items-center justify-between border rounded-md px-3 py-2 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">{selected.category ?? "—"}{selected.sku ? ` · ${selected.sku}` : ""}</p>
                </div>
                <button onClick={resetArticle} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="mt-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={artQuery} onChange={(e) => setArtQuery(e.target.value)} className="pl-9" placeholder="Pretraži katalog (ili upiši ručno)..." />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto border rounded-md bg-white shadow-lg">
                    {results.map((it) => (
                      <button key={it.id} onClick={() => pickArticle(it)}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0">
                        <p className="text-sm font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.category ?? "—"} {it.salePrice ? `· RSD ${Number(it.salePrice).toLocaleString()}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cena (RSD) *</label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Način plaćanja</label>
              <select value={payment} onChange={(e) => setPayment(e.target.value as "cash" | "card" | "transfer")}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
                {payments.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={needsCorrection} onChange={(e) => toggleCorrection(e.target.checked)} />
            Ide na korekciju
          </label>
          {needsCorrection && (
            <Input value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="Šta se koriguje (npr. skratiti nogavice)" className="text-sm" />
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Naplaćeno odmah {needsCorrection && <span className="text-xs text-muted-foreground">(korekcija se obično plaća pri preuzimanju)</span>}
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <button onClick={submit} disabled={isPending}
            className="w-full bg-black text-white rounded-md py-2.5 text-sm font-medium hover:bg-black/80 disabled:opacity-50 flex items-center justify-center gap-2">
            <Package className="w-4 h-4" /> {isPending ? "Čuvanje..." : "Kreiraj nalog"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
