"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPurchase } from "@/lib/actions/purchases";
import { searchCustomersLite } from "@/lib/actions/customers";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type { Customer, Material, InventoryItem } from "@/lib/db/schema";

const steps = ["Klijent", "Nalozi", "Avans i potvrda"];

type OrderKind = "domaca" | "munro" | "gotov";

const kindLabels: Record<OrderKind, string> = {
  domaca: "Domaća proizvodnja",
  munro: "Munro",
  gotov: "Gotov proizvod",
};
const kindHint: Record<OrderKind, string> = {
  domaca: "rok 10-15 radnih dana",
  munro: "rok 4-6 nedelja",
  gotov: "gotova roba / usluga",
};

// Munro vrste komada (Aleksandrov spisak). Dizajn opcije se biraju u Munru,
// ne kod nas — njihov sistem ne dopušta kreiranje naloga spolja (v. CLAUDE.md §16/§24).
const MUNRO_ARTIKLI = [
  "Dvodelno odelo", "Trodelno odelo", "Sako", "Pantalone", "Prsluk",
  "Košulja", "Knit", "Obuća", "Aksesoar",
];

// Auto-predlog roka po tipu (dana od danas)
const kindRokDana: Record<OrderKind, number> = { domaca: 15, munro: 42, gotov: 7 };
function rokZaKind(kind: OrderKind): string {
  const d = new Date();
  d.setDate(d.getDate() + kindRokDana[kind]);
  return d.toISOString().split("T")[0];
}

interface Item {
  artikal: string;
  quantity: number;
  unitPrice: string;
  material: string;
  collarType: string;
  cuffType: string;
  templateType: string;
  templateSize: string;
  monogram: boolean;
  monogramText: string;
  monogramPosition: string;
  monogramColor: string;
  monogramFont: string;
  showDetails: boolean;
}
interface Nalog {
  orderKind: OrderKind;
  dueDate: string;
  notes: string;
  items: Item[];
}

function emptyItem(): Item {
  return {
    artikal: "", quantity: 1, unitPrice: "", material: "",
    collarType: "Klasična", cuffType: "Jednostruka",
    templateType: "", templateSize: "",
    monogram: false, monogramText: "", monogramPosition: "Štej", monogramColor: "", monogramFont: "Pisano",
    showDetails: false,
  };
}
function emptyNalog(kind: OrderKind = "domaca"): Nalog {
  return { orderKind: kind, dueDate: rokZaKind(kind), notes: "", items: [emptyItem()] };
}

export function NewOrderClient({
  materials, inventoryItems,
}: { materials: Material[]; inventoryItems: InventoryItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") ?? "";

  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(preselectedCustomerId ? 1 : 0);
  const [customerSearch, setCustomerSearch] = useState("");
  // Klijenti se traže na serveru (4.000+ ih je) — u browseru je samo rezultat
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const customerId = selectedCustomer?.id ?? "";

  useEffect(() => {
    if (preselectedCustomerId) {
      searchCustomersLite("", preselectedCustomerId).then((r) => {
        if (r[0]) setSelectedCustomer(r[0]);
      });
    }
  }, [preselectedCustomerId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = customerSearch.trim();
      if (q.length < 2) { setCustomerResults([]); return; }
      setSearching(true);
      try { setCustomerResults(await searchCustomersLite(q)); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);
  const [nalozi, setNalozi] = useState<Nalog[]>([emptyNalog()]);
  const [avans, setAvans] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [error, setError] = useState("");
  // Isti ključ za sve pokušaje ove forme — retry ne pravi duplu porudžbinu
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  const fabrics = materials.filter((m) => m.category === "Tkanina" || m.category === "Postava");

  // — Izračun ukupne sume —
  const total = useMemo(
    () => nalozi.reduce((s, n) => s + n.items.reduce((si, it) => si + (Number(it.unitPrice) || 0) * it.quantity, 0), 0),
    [nalozi]
  );

  // — Mutacije naloga/stavki —
  const updateNalog = (ni: number, patch: Partial<Nalog>) =>
    setNalozi((prev) => prev.map((n, i) => (i === ni ? { ...n, ...patch } : n)));
  const setKind = (ni: number, kind: OrderKind) =>
    updateNalog(ni, { orderKind: kind, dueDate: rokZaKind(kind) });
  const addNalog = () => setNalozi((prev) => [...prev, emptyNalog()]);
  const removeNalog = (ni: number) => setNalozi((prev) => prev.filter((_, i) => i !== ni));
  const addItem = (ni: number) =>
    setNalozi((prev) => prev.map((n, i) => (i === ni ? { ...n, items: [...n.items, emptyItem()] } : n)));
  const removeItem = (ni: number, ii: number) =>
    setNalozi((prev) => prev.map((n, i) => (i === ni ? { ...n, items: n.items.filter((_, j) => j !== ii) } : n)));
  const updateItem = (ni: number, ii: number, patch: Partial<Item>) =>
    setNalozi((prev) => prev.map((n, i) =>
      i === ni ? { ...n, items: n.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : n));

  const naloziValid = nalozi.every((n) => n.items.every((it) => it.artikal.trim()));

  const handleSubmit = () => {
    setError("");
    startTransition(async () => {
      try {
        await createPurchase({
          customerId,
          avansAmount: Number(avans) || 0,
          paymentMethod,
          notes: purchaseNotes || undefined,
          idempotencyKey,
          nalozi: nalozi.map((n) => ({
            orderKind: n.orderKind,
            dueDate: n.dueDate || undefined,
            notes: n.notes || undefined,
            items: n.items.map((it) => ({
              artikal: it.artikal,
              quantity: it.quantity,
              unitPrice: Number(it.unitPrice) || 0,
              material: it.material || undefined,
              templateNumber: (it.templateType && it.templateSize) ? `${it.templateType} ${it.templateSize}` : undefined,
              collarType: n.orderKind === "domaca" ? it.collarType : undefined,
              cuffType: n.orderKind === "domaca" ? it.cuffType : undefined,
              fitType: (it.templateType && it.templateSize) ? `${it.templateType} / ${it.templateSize}` : undefined,
              monogramData: it.monogram
                ? { tekst: it.monogramText, pozicija: it.monogramPosition, boja: it.monogramColor, font: it.monogramFont }
                : undefined,
            })),
          })),
        });
        router.push("/orders");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Greška pri kreiranju porudžbine.");
      }
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/orders" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="w-4 h-4" /> Nazad na naloge
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Nova porudžbina</h1>
        <p className="text-muted-foreground text-sm mt-1">Jedan dolazak klijenta — jedan ili više naloga</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
              ${i <= step ? "bg-black text-white" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className={`h-px w-8 ${i < step ? "bg-black" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* ── Korak 1 — Klijent ── */}
      {step === 0 && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-medium">Odaberi klijenta</h2>
          {selectedCustomer && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-black bg-black/5">
              <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-medium shrink-0">
                {selectedCustomer.firstName[0] ?? ""}{selectedCustomer.lastName[0] ?? ""}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                <p className="text-xs text-muted-foreground">{selectedCustomer.phone} · {selectedCustomer.templateNumber ?? "—"}</p>
              </div>
              <Check className="w-4 h-4 ml-auto text-black" />
            </div>
          )}
          <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Kucaj ime ili telefon (bar 2 slova)..." autoFocus />
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {searching && <p className="text-sm text-muted-foreground text-center py-2">Tražim...</p>}
            {!searching && customerResults.length === 0 && customerSearch.trim().length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nema rezultata za &quot;{customerSearch}&quot;</p>
            )}
            {customerResults.map((c) => (
              <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${customerId === c.id ? "border-black bg-black/5" : "border-transparent hover:bg-muted/50"}`}>
                <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-medium shrink-0">
                  {c.firstName[0]}{c.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-muted-foreground">{c.phone} · {c.templateNumber ?? "—"}</p>
                </div>
                {customerId === c.id && <Check className="w-4 h-4 ml-auto text-black" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Korak 2 — Nalozi ── */}
      {step === 1 && (
        <div className="space-y-4">
          {nalozi.map((nalog, ni) => (
            <div key={ni} className="bg-white border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Nalog {ni + 1}</h3>
                {nalozi.length > 1 && (
                  <button onClick={() => removeNalog(ni)} className="text-muted-foreground hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tip naloga */}
              <div className="grid grid-cols-3 gap-2">
                {(["domaca", "munro", "gotov"] as OrderKind[]).map((k) => (
                  <button key={k} type="button" onClick={() => setKind(ni, k)}
                    className={`py-2 px-2 rounded-md border text-xs font-medium transition-colors text-center
                      ${nalog.orderKind === k ? "border-black bg-black text-white" : "border-muted bg-white hover:bg-muted/50"}`}>
                    <div>{kindLabels[k]}</div>
                    <div className={`text-[10px] mt-0.5 ${nalog.orderKind === k ? "text-white/70" : "text-muted-foreground"}`}>{kindHint[k]}</div>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Rok isporuke</label>
                <Input type="date" value={nalog.dueDate} onChange={(e) => updateNalog(ni, { dueDate: e.target.value })} className="mt-1" />
              </div>

              {/* Stavke */}
              <div className="space-y-3">
                {nalog.items.map((it, ii) => (
                  <div key={ii} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-muted-foreground">Artikal *</label>
                        {nalog.orderKind === "munro" ? (
                          // Munro: bira se vrsta komada. Dizajn detalji se unose u Munru, ne kod nas.
                          <select value={it.artikal}
                            onChange={(e) => updateItem(ni, ii, { artikal: e.target.value })}
                            className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                            <option value="">— Izaberi vrstu —</option>
                            {MUNRO_ARTIKLI.map((a) => <option key={a} value={a}>{a}</option>)}
                          </select>
                        ) : (
                          <input list="artikli" value={it.artikal}
                            onChange={(e) => updateItem(ni, ii, { artikal: e.target.value })}
                            className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                            placeholder="npr. Košulja Puplin IT021" />
                        )}
                      </div>
                      {nalog.items.length > 1 && (
                        <button onClick={() => removeItem(ni, ii)} className="mt-6 text-muted-foreground hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Količina</label>
                        <Input type="number" min={1} value={it.quantity}
                          onChange={(e) => updateItem(ni, ii, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cena / kom (RSD)</label>
                        <Input type="number" value={it.unitPrice}
                          onChange={(e) => updateItem(ni, ii, { unitPrice: e.target.value })} className="mt-1" placeholder="0" />
                      </div>
                    </div>

                    {/* Munro: detalji se unose kod njih, ne kod nas */}
                    {nalog.orderKind === "munro" && (
                      <p className="text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded px-2 py-1.5">
                        Mere i dizajn detalje unosiš u Munru. Posle kreiranja naloga imaš dugme „Otvori u GoCreate&rdquo;.
                      </p>
                    )}

                    {/* Krojački detalji — samo za domaću proizvodnju */}
                    {nalog.orderKind === "domaca" && (
                      <>
                        <button onClick={() => updateItem(ni, ii, { showDetails: !it.showDetails })}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${it.showDetails ? "rotate-180" : ""}`} />
                          Krojački detalji (kragna, manžetna, šablon, inicijali)
                        </button>
                        {it.showDetails && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground">Kragna</label>
                                <select value={it.collarType} onChange={(e) => updateItem(ni, ii, { collarType: e.target.value })}
                                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm bg-white">
                                  {["Klasična", "Talijanska", "Button-down", "Mao", "Windsor"].map((o) => <option key={o}>{o}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Manžetna</label>
                                <select value={it.cuffType} onChange={(e) => updateItem(ni, ii, { cuffType: e.target.value })}
                                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm bg-white">
                                  {["Jednostruka", "Dupla", "Francuska"].map((o) => <option key={o}>{o}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground">Šablon</label>
                                <select value={it.templateType} onChange={(e) => updateItem(ni, ii, { templateType: e.target.value, templateSize: "" })}
                                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm bg-white">
                                  <option value="">—</option>
                                  <option>Munro slim</option><option>Naš slim</option><option>Olimp</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Veličina</label>
                                <select value={it.templateSize} onChange={(e) => updateItem(ni, ii, { templateSize: e.target.value })}
                                  disabled={!it.templateType}
                                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm bg-white disabled:opacity-40">
                                  <option value="">—</option>
                                  {it.templateType === "Munro slim" && ["38","39","40","41","42","43","44","45"].map((s) => <option key={s}>{s}</option>)}
                                  {it.templateType === "Naš slim" && ["38","39","40","41","42","43","44"].map((s) => <option key={s}>{s}</option>)}
                                  {it.templateType === "Olimp" && ["S","M","L","XL","XXL","XXXL"].map((s) => <option key={s}>{s}</option>)}
                                </select>
                              </div>
                            </div>
                            {nalog.orderKind === "domaca" && fabrics.length > 0 && (
                              <div>
                                <label className="text-xs text-muted-foreground">Materijal</label>
                                <select value={it.material} onChange={(e) => updateItem(ni, ii, { material: e.target.value })}
                                  className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm bg-white">
                                  <option value="">— Bez / ručno —</option>
                                  {fabrics.map((m) => <option key={m.id} value={m.name}>{m.name} {m.code ? `(${m.code})` : ""}</option>)}
                                </select>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <input type="checkbox" id={`mono-${ni}-${ii}`} checked={it.monogram}
                                onChange={(e) => updateItem(ni, ii, { monogram: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300 accent-black" />
                              <label htmlFor={`mono-${ni}-${ii}`} className="text-sm">Inicijali</label>
                            </div>
                            {it.monogram && (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs text-muted-foreground">Šta piše (inicijali)</label>
                                  <Input value={it.monogramText} onChange={(e) => updateItem(ni, ii, { monogramText: e.target.value })}
                                    placeholder="npr. P.P.  ili  M & P" className="mt-1 text-sm" />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <select value={it.monogramPosition} onChange={(e) => updateItem(ni, ii, { monogramPosition: e.target.value })}
                                    className="border rounded-md px-2 py-1.5 text-sm bg-white">
                                    {["Štej", "Manžetna", "Prednjica"].map((o) => <option key={o}>{o}</option>)}
                                  </select>
                                  <Input value={it.monogramColor} onChange={(e) => updateItem(ni, ii, { monogramColor: e.target.value })} placeholder="Boja" className="text-sm" />
                                  <select value={it.monogramFont} onChange={(e) => updateItem(ni, ii, { monogramFont: e.target.value })}
                                    className="border rounded-md px-2 py-1.5 text-sm bg-white">
                                    {["Pisano", "Štampano — Ćirilica", "Pisano — Latinica", "Štampano — Latinica"].map((o) => <option key={o}>{o}</option>)}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                <button onClick={() => addItem(ni)}
                  className="flex items-center gap-1.5 text-sm text-black hover:underline">
                  <Plus className="w-4 h-4" /> Dodaj stavku
                </button>
              </div>
            </div>
          ))}

          <button onClick={addNalog}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-3 text-sm font-medium text-muted-foreground hover:border-black hover:text-black transition-colors">
            <Plus className="w-4 h-4" /> Dodaj još jedan nalog
          </button>

          {/* datalist artikala iz inventara */}
          <datalist id="artikli">
            {inventoryItems.map((it) => <option key={it.id} value={it.name} />)}
          </datalist>
        </div>
      )}

      {/* ── Korak 3 — Avans i potvrda ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="font-medium">Pregled porudžbine</h2>
            <div className="text-sm">
              <span className="text-muted-foreground">Klijent: </span>
              <span className="font-medium">{selectedCustomer?.firstName} {selectedCustomer?.lastName}</span>
            </div>
            {nalozi.map((n, ni) => {
              const nalogTotal = n.items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * it.quantity, 0);
              return (
                <div key={ni} className="bg-muted/30 rounded-lg p-3">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Nalog {ni + 1} · {kindLabels[n.orderKind]}</span>
                    <span>RSD {nalogTotal.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Rok: {n.dueDate || "—"}</div>
                  <div className="mt-2 space-y-1">
                    {n.items.map((it, ii) => (
                      <div key={ii} className="flex justify-between text-xs">
                        <span>{it.artikal || "—"} ×{it.quantity}</span>
                        <span className="text-muted-foreground">RSD {((Number(it.unitPrice) || 0) * it.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between text-base font-bold border-t pt-3">
              <span>Ukupno</span>
              <span>RSD {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="font-medium">Avans</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Iznos avansa (RSD)</label>
                <Input type="number" value={avans} onChange={(e) => setAvans(e.target.value)} className="mt-1" placeholder="0" />
                <button onClick={() => setAvans(String(Math.round(total / 2)))}
                  className="text-xs text-black hover:underline mt-1">Postavi 50% (RSD {Math.round(total / 2).toLocaleString()})</button>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Način plaćanja</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card" | "transfer")}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="cash">Gotovina</option>
                  <option value="card">Kartica</option>
                  <option value="transfer">Prenos</option>
                </select>
              </div>
            </div>
            {Number(avans) > 0 && (
              <div className="text-sm text-muted-foreground">
                Ostatak za naplatu pri preuzimanju: <strong className="text-foreground">RSD {Math.max(0, total - Number(avans)).toLocaleString()}</strong>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Napomena (opciono)</label>
              <textarea value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-16"
                placeholder="npr. svadba, hitno..." />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Navigacija */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" /> Nazad
          </button>
        )}
        <div className="flex-1" />
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={(step === 0 && !customerId) || (step === 1 && !naloziValid)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors disabled:opacity-40">
            Dalje <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={isPending || !customerId || !naloziValid}
            className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-md text-sm hover:bg-black/80 transition-colors disabled:opacity-40">
            <Check className="w-4 h-4" /> {isPending ? "Kreiranje..." : "Kreiraj porudžbinu"}
          </button>
        )}
      </div>
    </div>
  );
}
