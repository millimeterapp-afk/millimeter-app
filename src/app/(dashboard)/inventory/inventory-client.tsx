"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createMaterial, receiveMaterial, createInventoryItem, receiveInventoryItem, updateMaterial, updateInventoryItem, importMaterials, importInventoryItems } from "@/lib/actions/inventory";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Plus, X, ArrowDown, Search, Pencil, Upload } from "lucide-react";
import type { Material, InventoryItem } from "@/lib/db/schema";

export function InventoryClient({ materials, inventoryItems }: { materials: Material[]; inventoryItems: InventoryItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"materials" | "items">("materials");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showReceive, setShowReceive] = useState<Material | null>(null);
  const [showReceiveItem, setShowReceiveItem] = useState<InventoryItem | null>(null);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [editMatForm, setEditMatForm] = useState({ name: "", code: "", category: "", unit: "m", price: "", reorderLevel: "" });
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editItemForm, setEditItemForm] = useState({ name: "", sku: "", category: "", salePrice: "", costPrice: "" });
  const [matForm, setMatForm] = useState({ name: "", code: "", category: "Tkanina", unit: "m", price: "", stock: "", reorderLevel: "5" });
  const [itemForm, setItemForm] = useState({ name: "", sku: "", category: "Gotova roba", quantity: "", salePrice: "", costPrice: "" });
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveNote, setReceiveNote] = useState("");
  const [importResult, setImportResult] = useState<{ inserted: number; total: number } | null>(null);
  const matFileRef = useRef<HTMLInputElement>(null);
  const itemFileRef = useRef<HTMLInputElement>(null);

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (m.code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredItems = inventoryItems.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (m.sku ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalMaterialValue = materials.reduce((sum, m) =>
    sum + Number(m.currentStock) * Number(m.lastPurchasePrice ?? 0), 0
  );

  const totalItemValue = inventoryItems.reduce((sum, i) =>
    sum + i.quantity * Number(i.salePrice ?? 0), 0
  );

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createMaterial({
        name: matForm.name,
        code: matForm.code || undefined,
        category: matForm.category,
        unit: matForm.unit,
        currentStock: Number(matForm.stock),
        lastPurchasePrice: matForm.price ? Number(matForm.price) : undefined,
        reorderLevel: matForm.reorderLevel ? Number(matForm.reorderLevel) : 5,
      });
      setShowAdd(false);
      setMatForm({ name: "", code: "", category: "Tkanina", unit: "m", price: "", stock: "", reorderLevel: "5" });
      router.refresh();
    });
  };

  const openEditMaterial = (m: Material) => {
    setEditMaterial(m);
    setEditMatForm({
      name: m.name,
      code: m.code ?? "",
      category: m.category ?? "",
      unit: m.unit,
      price: m.lastPurchasePrice ?? "",
      reorderLevel: m.reorderLevel ?? "5",
    });
  };

  const handleSaveEditMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMaterial) return;
    startTransition(async () => {
      await updateMaterial(editMaterial.id, {
        name: editMatForm.name,
        code: editMatForm.code || undefined,
        category: editMatForm.category || undefined,
        unit: editMatForm.unit,
        lastPurchasePrice: editMatForm.price ? Number(editMatForm.price) : null,
        reorderLevel: editMatForm.reorderLevel ? Number(editMatForm.reorderLevel) : null,
      });
      setEditMaterial(null);
      router.refresh();
    });
  };

  const openEditItem = (i: InventoryItem) => {
    setEditItem(i);
    setEditItemForm({
      name: i.name,
      sku: i.sku ?? "",
      category: i.category ?? "",
      salePrice: i.salePrice ?? "",
      costPrice: i.costPrice ?? "",
    });
  };

  const handleSaveEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    startTransition(async () => {
      await updateInventoryItem(editItem.id, {
        name: editItemForm.name,
        sku: editItemForm.sku || undefined,
        category: editItemForm.category || undefined,
        salePrice: editItemForm.salePrice ? Number(editItemForm.salePrice) : null,
        costPrice: editItemForm.costPrice ? Number(editItemForm.costPrice) : null,
      });
      setEditItem(null);
      router.refresh();
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createInventoryItem({
        name: itemForm.name,
        sku: itemForm.sku || undefined,
        category: itemForm.category,
        quantity: Number(itemForm.quantity),
        salePrice: itemForm.salePrice ? Number(itemForm.salePrice) : undefined,
        costPrice: itemForm.costPrice ? Number(itemForm.costPrice) : undefined,
      });
      setShowAdd(false);
      setItemForm({ name: "", sku: "", category: "Gotova roba", quantity: "", salePrice: "", costPrice: "" });
      router.refresh();
    });
  };

  const handleReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceive) return;
    startTransition(async () => {
      await receiveMaterial(showReceive.id, Number(receiveQty), receiveNote || undefined);
      setShowReceive(null);
      setReceiveQty("");
      setReceiveNote("");
      router.refresh();
    });
  };

  const handleReceiveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceiveItem) return;
    startTransition(async () => {
      await receiveInventoryItem(showReceiveItem.id, Number(receiveQty), receiveNote || undefined);
      setShowReceiveItem(null);
      setReceiveQty("");
      setReceiveNote("");
      router.refresh();
    });
  };

  const handleImportMaterials = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const result = await importMaterials(fd);
      setImportResult(result);
      if (matFileRef.current) matFileRef.current.value = "";
      router.refresh();
    });
  };

  const handleImportItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const result = await importInventoryItems(fd);
      setImportResult(result);
      if (itemFileRef.current) itemFileRef.current.value = "";
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Zalihe</h1>
          <p className="text-muted-foreground text-sm mt-1">Materijali i gotova roba</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "materials" ? (
            <>
              <label className={`flex items-center gap-2 border px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-muted transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-4 h-4" /> {isPending ? "Uvoz..." : "Uvezi Excel"}
                <input ref={matFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportMaterials} />
              </label>
            </>
          ) : (
            <label className={`flex items-center gap-2 border px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-muted transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload className="w-4 h-4" /> {isPending ? "Uvoz..." : "Uvezi Excel"}
              <input ref={itemFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportItems} />
            </label>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
            <Plus className="w-4 h-4" /> Novi artikal
          </button>
        </div>
      </div>

      {/* Modal — rezultat uvoza */}
      {importResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-lg font-semibold">Uvoz završen</h2>
            <p className="text-muted-foreground text-sm">
              Uvezeno <strong>{importResult.inserted}</strong> od {importResult.total} redova.
            </p>
            <button onClick={() => setImportResult(null)}
              className="w-full bg-black text-white rounded-md py-2 text-sm hover:bg-black/80">
              Zatvori
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Materijali", value: String(materials.length) },
          { label: "Gotova roba", value: String(inventoryItems.length) },
          { label: "Niske zalihe (mat.)", value: `${materials.filter(m => (Number(m.currentStock) - Number(m.reservedStock)) < 5).length} art.`, color: "text-orange-600" },
          { label: "Vrednost zaliha", value: `RSD ${Math.round(totalMaterialValue + totalItemValue).toLocaleString()}` },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.color || ""}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: "materials" as const, label: "Materijali", count: materials.length },
          { key: "items" as const, label: "Gotova roba", count: inventoryItems.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearch(""); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5
              ${activeTab === tab.key ? "border-black text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-black text-white" : "bg-muted text-muted-foreground"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pretraži..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Modal — prijem materijala */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Prijem robe</h2>
              <button onClick={() => setShowReceive(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{showReceive.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Trenutno stanje: {showReceive.currentStock} {showReceive.unit}</p>
            </div>
            <form onSubmit={handleReceive} className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground">Količina za prijem ({showReceive.unit}) *</label>
                <Input type="number" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} required className="mt-1" placeholder="0" min="0.1" step="0.1" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Napomena</label>
                <Input value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} className="mt-1" placeholder="Br. fakture, dobavljač..." /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowReceive(null)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "..." : "+ Dodaj na stanje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — editovanje materijala */}
      {editMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Uredi materijal</h2>
              <button onClick={() => setEditMaterial(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSaveEditMaterial} className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground">Naziv *</label>
                <Input value={editMatForm.name} onChange={(e) => setEditMatForm({ ...editMatForm, name: e.target.value })} required className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Šifra</label>
                  <Input value={editMatForm.code} onChange={(e) => setEditMatForm({ ...editMatForm, code: e.target.value })} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Kategorija</label>
                  <Input value={editMatForm.category} onChange={(e) => setEditMatForm({ ...editMatForm, category: e.target.value })} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Jed. mere</label>
                  <select value={editMatForm.unit} onChange={(e) => setEditMatForm({ ...editMatForm, unit: e.target.value })}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    {["m", "kom", "kg"].map(u => <option key={u}>{u}</option>)}
                  </select></div>
                <div><label className="text-xs font-medium text-muted-foreground">Cena/jed. (RSD )</label>
                  <Input type="number" value={editMatForm.price} onChange={(e) => setEditMatForm({ ...editMatForm, price: e.target.value })} className="mt-1" placeholder="0" /></div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Min. nivo zaliha</label>
                  <Input type="number" value={editMatForm.reorderLevel} onChange={(e) => setEditMatForm({ ...editMatForm, reorderLevel: e.target.value })} className="mt-1" placeholder="5" min="0" step="0.5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                Notifikacija &quot;Niske zalihe&quot; se prikazuje kada je slobodna količina ispod minimalnog nivoa.
              </p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditMaterial(null)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Sačuvaj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — prijem gotove robe */}
      {showReceiveItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Prijem gotove robe</h2>
              <button onClick={() => setShowReceiveItem(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{showReceiveItem.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Trenutno stanje: {showReceiveItem.quantity} kom</p>
            </div>
            <form onSubmit={handleReceiveItem} className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground">Količina za prijem (kom) *</label>
                <Input type="number" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} required className="mt-1" placeholder="0" min="1" step="1" /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Napomena</label>
                <Input value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} className="mt-1" placeholder="Br. fakture, dobavljač..." /></div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowReceiveItem(null)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "..." : "+ Dodaj na stanje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — editovanje gotove robe */}
      {editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Uredi artikal</h2>
              <button onClick={() => setEditItem(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleSaveEditItem} className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground">Naziv *</label>
                <Input value={editItemForm.name} onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })} required className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">SKU / Šifra</label>
                  <Input value={editItemForm.sku} onChange={(e) => setEditItemForm({ ...editItemForm, sku: e.target.value })} className="mt-1" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Kategorija</label>
                  <Input value={editItemForm.category} onChange={(e) => setEditItemForm({ ...editItemForm, category: e.target.value })} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground">Prod. cena (RSD )</label>
                  <Input type="number" value={editItemForm.salePrice} onChange={(e) => setEditItemForm({ ...editItemForm, salePrice: e.target.value })} className="mt-1" placeholder="0" /></div>
                <div><label className="text-xs font-medium text-muted-foreground">Nabavna (RSD )</label>
                  <Input type="number" value={editItemForm.costPrice} onChange={(e) => setEditItemForm({ ...editItemForm, costPrice: e.target.value })} className="mt-1" placeholder="0" /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditItem(null)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Sačuvaj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — novi artikal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{activeTab === "materials" ? "Novi materijal" : "Nova gotova roba"}</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            {activeTab === "materials" ? (
              <form onSubmit={handleAddMaterial} className="space-y-3">
                <div><label className="text-xs font-medium text-muted-foreground">Naziv *</label>
                  <Input value={matForm.name} onChange={(e) => setMatForm({ ...matForm, name: e.target.value })} required className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Šifra</label>
                    <Input value={matForm.code} onChange={(e) => setMatForm({ ...matForm, code: e.target.value })} className="mt-1" placeholder="FAB-010" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Kategorija</label>
                    <select value={matForm.category} onChange={(e) => setMatForm({ ...matForm, category: e.target.value })}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                      {["Tkanina", "Postava", "Pribor"].map(c => <option key={c}>{c}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Jed. mere</label>
                    <select value={matForm.unit} onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                      {["m", "kom", "kg"].map(u => <option key={u}>{u}</option>)}
                    </select></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Poč. stanje</label>
                    <Input type="number" value={matForm.stock} onChange={(e) => setMatForm({ ...matForm, stock: e.target.value })} className="mt-1" placeholder="0" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Cena/jed. (RSD )</label>
                    <Input type="number" value={matForm.price} onChange={(e) => setMatForm({ ...matForm, price: e.target.value })} className="mt-1" placeholder="0" /></div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Min. nivo zaliha</label>
                    <Input type="number" value={matForm.reorderLevel} onChange={(e) => setMatForm({ ...matForm, reorderLevel: e.target.value })} className="mt-1" placeholder="5" min="0" step="0.5" />
                    <p className="text-xs text-muted-foreground mt-0.5">Upozorenje ispod ovog nivoa</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                  <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                    {isPending ? "Dodavanje..." : "Dodaj materijal"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddItem} className="space-y-3">
                <div><label className="text-xs font-medium text-muted-foreground">Naziv *</label>
                  <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required className="mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">SKU / Šifra</label>
                    <Input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} className="mt-1" placeholder="ART-001" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Kategorija</label>
                    <Input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} className="mt-1" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium text-muted-foreground">Količina</label>
                    <Input type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} className="mt-1" placeholder="0" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Prod. cena (RSD )</label>
                    <Input type="number" value={itemForm.salePrice} onChange={(e) => setItemForm({ ...itemForm, salePrice: e.target.value })} className="mt-1" placeholder="0" /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">Nabavna (RSD )</label>
                    <Input type="number" value={itemForm.costPrice} onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })} className="mt-1" placeholder="0" /></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                  <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                    {isPending ? "Dodavanje..." : "Dodaj artikal"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Tabela — Materijali */}
      {activeTab === "materials" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Artikal</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Kategorija</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Stanje</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Rezervisano</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Slobodno</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Min. nivo</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Cena/jed.</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((item) => {
                  const free = Number(item.currentStock) - Number(item.reservedStock);
                  const lowStock = free < 5;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {lowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs font-mono text-muted-foreground">{item.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{item.category}</span></td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.currentStock} {item.unit}</td>
                      <td className="px-4 py-3 text-sm text-right text-yellow-600 font-medium">
                        {Number(item.reservedStock) > 0 ? `${item.reservedStock} ${item.unit}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${lowStock ? "text-orange-600" : "text-green-600"}`}>
                          {free % 1 === 0 ? free : free.toFixed(1)} {item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.reorderLevel ? (
                          <span className={`text-xs font-medium ${lowStock ? "text-orange-600" : "text-muted-foreground"}`}>
                            {item.reorderLevel} {item.unit}
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {item.lastPurchasePrice ? `RSD ${item.lastPurchasePrice}/${item.unit}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditMaterial(item)}
                            className="text-xs flex items-center gap-1 border px-2 py-1 rounded hover:bg-muted transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => { setShowReceive(item); setReceiveQty(""); setReceiveNote(""); }}
                            className="text-xs flex items-center gap-1 border px-2 py-1 rounded hover:bg-muted transition-colors">
                            <ArrowDown className="w-3 h-3" /> Prijem
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredMaterials.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Nema materijala.</div>
            )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela — Gotova roba */}
      {activeTab === "items" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[750px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Artikal</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Kategorija</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Na stanju</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Rezervisano</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Slobodno</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Prod. cena</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Nabavna</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const free = item.quantity - item.reservedQuantity;
                  const lowStock = free <= 0;
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {lowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs font-mono text-muted-foreground">{item.sku ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded">{item.category ?? "—"}</span></td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{item.quantity} kom</td>
                      <td className="px-4 py-3 text-sm text-right text-yellow-600 font-medium">
                        {item.reservedQuantity > 0 ? `${item.reservedQuantity} kom` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${lowStock ? "text-orange-600" : "text-green-600"}`}>
                          {free} kom
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {item.salePrice ? `RSD ${Number(item.salePrice).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {item.costPrice ? `RSD ${Number(item.costPrice).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditItem(item)}
                            className="text-xs flex items-center gap-1 border px-2 py-1 rounded hover:bg-muted transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => { setShowReceiveItem(item); setReceiveQty(""); setReceiveNote(""); }}
                            className="text-xs flex items-center gap-1 border px-2 py-1 rounded hover:bg-muted transition-colors">
                            <ArrowDown className="w-3 h-3" /> Prijem
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">Nema gotove robe.</div>
            )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
