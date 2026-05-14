"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode";
import {
  generateMaterialBarcode, generateInventoryItemBarcode,
  lookupByBarcode, receiveMaterial, receiveInventoryItem,
} from "@/lib/actions/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Scan, Tag, Printer, Plus, Check, PackageCheck, Search } from "lucide-react";
import type { Material, InventoryItem } from "@/lib/db/schema";

type Tab = "scan" | "generate" | "print";

type ScannedItem = {
  type: "material" | "inventory_item";
  item: Material | InventoryItem;
  quantity: number;
};

export function BarcodesClient({
  materials, inventoryItems,
}: {
  materials: Material[];
  inventoryItems: InventoryItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("scan");

  // --- SKENIRANJE ---
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanResult, setScanResult] = useState<ScannedItem | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanQty, setScanQty] = useState(1);
  const [scanNote, setScanNote] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scannedList, setScannedList] = useState<ScannedItem[]>([]);

  // Fokus na scan input kad je tab aktivan
  useEffect(() => {
    if (tab === "scan") scanRef.current?.focus();
  }, [tab]);

  const handleScan = useCallback(async (barcode: string) => {
    if (!barcode.trim()) return;
    setScanError("");
    setScanResult(null);
    setScanSuccess(false);

    const result = await lookupByBarcode(barcode.trim());
    if (!result) {
      setScanError(`Barkod "${barcode}" nije pronađen u sistemu.`);
    } else {
      setScanResult({ ...result, quantity: 1 });
      setScanQty(1);
    }
    setScanValue("");
  }, []);

  // USB scanner šalje Enter na kraju
  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanValue);
    }
  };

  const handleReceive = () => {
    if (!scanResult) return;
    startTransition(async () => {
      if (scanResult.type === "material") {
        await receiveMaterial(scanResult.item.id, scanQty, scanNote || undefined);
      } else {
        await receiveInventoryItem(scanResult.item.id, scanQty, scanNote || undefined);
      }
      setScannedList(prev => [...prev, { ...scanResult, quantity: scanQty }]);
      setScanResult(null);
      setScanNote("");
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 2000);
      router.refresh();
      scanRef.current?.focus();
    });
  };

  // --- GENERISANJE ---
  const [search, setSearch] = useState("");
  const [generatedBarcodes, setGeneratedBarcodes] = useState<Record<string, string>>({});

  const allItems = [
    ...materials.map(m => ({ ...m, _type: "material" as const, _label: `Materijal · ${m.unit}` })),
    ...inventoryItems.map(i => ({ ...i, _type: "inventory_item" as const, _label: "Gotova roba" })),
  ];

  const filtered = allItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = (id: string, type: "material" | "inventory_item") => {
    startTransition(async () => {
      const barcode = type === "material"
        ? await generateMaterialBarcode(id)
        : await generateInventoryItemBarcode(id);
      setGeneratedBarcodes(prev => ({ ...prev, [id]: barcode }));
      router.refresh();
    });
  };

  // --- ŠTAMPA ---
  const [printSelected, setPrintSelected] = useState<Set<string>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  const togglePrint = (id: string) => {
    setPrintSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    const items = allItems.filter(i => printSelected.has(i.id) && i.barcode);
    if (items.length === 0) return;

    const w = window.open("", "_blank");
    if (!w) return;

    const labelsHtml = items.map(item => `
      <div class="label">
        <p class="name">${item.name}</p>
        <svg id="bc-${item.id}"></svg>
        <p class="code">${item.barcode}</p>
      </div>
    `).join("");

    w.document.write(`
      <html><head><title>Barkod labele</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <style>
        body { margin: 0; padding: 16px; font-family: Arial, sans-serif; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .label { border: 1px solid #ddd; border-radius: 4px; padding: 8px 12px; text-align: center; width: 160px; }
        .name { font-size: 10px; font-weight: bold; margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .code { font-size: 9px; color: #666; margin: 4px 0 0; font-family: monospace; }
        svg { max-width: 140px; height: 50px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>
        <div class="grid">${labelsHtml}</div>
        <script>
          window.onload = function() {
            ${items.map(item => `
              JsBarcode("#bc-${item.id}", "${item.barcode}", {
                format: "CODE128", width: 1.5, height: 40, displayValue: false, margin: 2
              });
            `).join("")}
            setTimeout(() => window.print(), 500);
          };
        <\/script>
      </body></html>
    `);
    w.document.close();
  };

  const itemsWithBarcodes = allItems.filter(i => i.barcode);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Barkodovi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {allItems.filter(i => i.barcode).length} od {allItems.length} artikala ima barkod
        </p>
      </div>

      {/* Tabovi */}
      <div className="flex gap-1 border-b">
        {[
          { key: "scan" as Tab, label: "Skeniranje", icon: Scan },
          { key: "generate" as Tab, label: "Generisanje", icon: Tag },
          { key: "print" as Tab, label: "Štampa labela", icon: Printer },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors
              ${tab === key ? "border-black text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── SKENIRANJE ── */}
      {tab === "scan" && (
        <div className="space-y-4 max-w-xl">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Scan className="w-4 h-4" /> Skeniraj barkod za prijem robe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Povezi USB skener — automatski šalje Enter. Ili unesi ručno i pritisni Enter.
              </p>
              <div className="relative">
                <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={scanRef}
                  value={scanValue}
                  onChange={e => setScanValue(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  placeholder="Skeniraj ili unesi barkod..."
                  className="pl-9 font-mono text-base"
                  autoComplete="off"
                />
              </div>

              {scanSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">
                  <Check className="w-4 h-4" /> Primljeno u sistem!
                </div>
              )}

              {scanError && (
                <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  {scanError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pronađeni artikal */}
          {scanResult && (
            <Card className="border-2 border-black">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-base">{scanResult.item.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{scanResult.item.barcode}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scanResult.type === "material"
                        ? `Materijal · Trenutno: ${(scanResult.item as Material).currentStock} ${(scanResult.item as Material).unit}`
                        : `Gotova roba · Trenutno: ${(scanResult.item as InventoryItem).quantity} kom`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    scanResult.type === "material" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  }`}>
                    {scanResult.type === "material" ? "Materijal" : "Roba"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Količina za prijem {scanResult.type === "material"
                        ? `(${(scanResult.item as Material).unit})`
                        : "(kom)"}
                    </label>
                    <Input
                      type="number"
                      value={scanQty}
                      onChange={e => setScanQty(Number(e.target.value))}
                      min="0.01"
                      step={scanResult.type === "material" ? "0.5" : "1"}
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Napomena</label>
                    <Input
                      value={scanNote}
                      onChange={e => setScanNote(e.target.value)}
                      placeholder="Opciono..."
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setScanResult(null)}
                    className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">
                    Otkaži
                  </button>
                  <button onClick={handleReceive} disabled={isPending || scanQty <= 0}
                    className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50 flex items-center justify-center gap-2">
                    <PackageCheck className="w-4 h-4" />
                    {isPending ? "Primanje..." : "Primi u sistem"}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista primljenih u ovoj sesiji */}
          {scannedList.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Primljeno u ovoj sesiji ({scannedList.length})
              </p>
              <div className="space-y-1">
                {scannedList.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-green-50 px-3 py-2 rounded-lg">
                    <span className="font-medium">{s.item.name}</span>
                    <span className="text-green-700 font-medium">
                      +{s.quantity} {s.type === "material" ? (s.item as Material).unit : "kom"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GENERISANJE ── */}
      {tab === "generate" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži artikle..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(item => {
              const barcode = generatedBarcodes[item.id] ?? item.barcode;
              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item._label}</p>
                        {barcode ? (
                          <p className="text-xs font-mono text-green-700 mt-1">{barcode}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Nema barkoda</p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {barcode ? (
                          <Barcode
                            value={barcode}
                            format="CODE128"
                            width={1.2}
                            height={36}
                            displayValue={false}
                            margin={2}
                          />
                        ) : (
                          <button
                            onClick={() => handleGenerate(item.id, item._type)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 text-xs bg-black text-white px-3 py-1.5 rounded hover:bg-black/80 disabled:opacity-50">
                            <Plus className="w-3 h-3" /> Generiši
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
                Nema rezultata
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ŠTAMPA ── */}
      {tab === "print" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Odaberi artikle za štampu ({printSelected.size} odabrano)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPrintSelected(new Set(itemsWithBarcodes.map(i => i.id)))}
                className="text-xs border px-3 py-1.5 rounded hover:bg-muted">
                Odaberi sve
              </button>
              <button
                onClick={() => setPrintSelected(new Set())}
                className="text-xs border px-3 py-1.5 rounded hover:bg-muted">
                Poništi
              </button>
              <button
                onClick={handlePrint}
                disabled={printSelected.size === 0}
                className="flex items-center gap-2 bg-black text-white text-xs px-4 py-1.5 rounded hover:bg-black/80 disabled:opacity-50">
                <Printer className="w-3.5 h-3.5" /> Štampaj labele
              </button>
            </div>
          </div>

          {itemsWithBarcodes.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
              Nema artikala sa barkodom. Idi na tab &quot;Generisanje&quot; da generišeš.
            </div>
          )}

          <div ref={printRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {itemsWithBarcodes.map(item => {
              const selected = printSelected.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => togglePrint(item.id)}
                  className={`border-2 rounded-xl p-3 cursor-pointer transition-colors text-center
                    ${selected ? "border-black bg-black/5" : "border-transparent hover:border-muted-foreground/30"}`}>
                  {selected && (
                    <div className="flex justify-end mb-1">
                      <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                  )}
                  <p className="text-xs font-medium truncate mb-2">{item.name}</p>
                  <Barcode
                    value={item.barcode!}
                    format="CODE128"
                    width={1.2}
                    height={40}
                    displayValue={true}
                    fontSize={9}
                    margin={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{item._label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
