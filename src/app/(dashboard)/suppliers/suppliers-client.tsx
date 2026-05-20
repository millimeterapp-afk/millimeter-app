"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSupplier, createSupplierInvoice, postInvoice,
  type InvoiceItemInput, type AdditionalCostInput,
} from "@/lib/actions/suppliers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, X, Building2, FileText, ChevronDown, ChevronUp, CheckCircle2, Trash2 } from "lucide-react";
import type {
  Supplier, SupplierInvoice, SupplierInvoiceItem,
  InvoiceAdditionalCost, Material, InventoryItem,
} from "@/lib/db/schema";

type InvoiceWithDetails = SupplierInvoice & {
  supplier: Supplier | null;
  items: (SupplierInvoiceItem & { material: Material | null; inventoryItem: InventoryItem | null })[];
  additionalCosts: InvoiceAdditionalCost[];
};

const costTypeLabels: Record<string, string> = {
  transport: "Transport",
  customs_duty: "Carina (%)",
  customs_fee: "Carinska naknada",
  other: "Ostalo",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  verified: "Verifikovano",
  posted: "Knjiženo",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  verified: "bg-blue-100 text-blue-700",
  posted: "bg-green-100 text-green-800",
};

const emptySupplierForm = { name: "", contactPerson: "", email: "", phone: "", country: "", taxId: "" };
const emptyInvoiceItem: InvoiceItemInput & { _type: "material" | "inventory" | "manual" } = {
  description: "", quantity: 1, unitPrice: 0, _type: "manual",
};

export function SuppliersClient({
  suppliers, invoices, materials, inventoryItems,
}: {
  suppliers: Supplier[];
  invoices: InvoiceWithDetails[];
  materials: Material[];
  inventoryItems: InventoryItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"invoices" | "suppliers">("invoices");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    currency: "EUR",
    notes: "",
  });
  const [invoiceItems, setInvoiceItems] = useState<(InvoiceItemInput & { _type: "material" | "inventory" | "manual"; _id: string })[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostInput[]>([]);

  const subtotal = invoiceItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const totalAdditional = additionalCosts.reduce((s, c) => {
    if (c.costType === "customs_duty" && c.customsDutyRate) {
      return s + (subtotal * c.customsDutyRate) / 100;
    }
    return s + (c.amount || 0);
  }, 0);
  const totalAmount = subtotal + totalAdditional;

  const addItem = () => {
    setInvoiceItems(prev => [...prev, { ...emptyInvoiceItem, _id: String(Date.now()) }]);
  };

  const removeItem = (id: string) => {
    setInvoiceItems(prev => prev.filter(i => i._id !== id));
  };

  const updateItem = (id: string, field: string, value: string | number) => {
    setInvoiceItems(prev => prev.map(i => {
      if (i._id !== id) return i;
      const updated = { ...i, [field]: value };
      // Ako se odabere materijal ili artikal, popuni opis i cijenu
      if (field === "materialId") {
        const mat = materials.find(m => m.id === value);
        if (mat) {
          return { ...updated, description: mat.name, _type: "material" as const,
            unitPrice: mat.lastPurchasePrice ? Number(mat.lastPurchasePrice) : updated.unitPrice };
        }
      }
      if (field === "inventoryItemId") {
        const item = inventoryItems.find(it => it.id === value);
        if (item) {
          return { ...updated, description: item.name, _type: "inventory" as const,
            unitPrice: item.costPrice ? Number(item.costPrice) : updated.unitPrice };
        }
      }
      return updated;
    }));
  };

  const addCost = (type: string) => {
    setAdditionalCosts(prev => [...prev, { costType: type, amount: 0, description: "" }]);
  };

  const removeCost = (idx: number) => {
    setAdditionalCosts(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCost = (idx: number, field: string, value: string | number) => {
    setAdditionalCosts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createSupplier(supplierForm);
      setShowSupplierForm(false);
      setSupplierForm(emptySupplierForm);
      router.refresh();
    });
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceItems.length === 0) return;
    startTransition(async () => {
      await createSupplierInvoice({
        supplierId: invoiceForm.supplierId || undefined,
        invoiceNumber: invoiceForm.invoiceNumber,
        invoiceDate: invoiceForm.invoiceDate,
        currency: invoiceForm.currency,
        notes: invoiceForm.notes || undefined,
        items: invoiceItems.map(({ _type, _id, ...rest }) => rest),
        additionalCosts,
      });
      setShowInvoiceForm(false);
      setInvoiceItems([]);
      setAdditionalCosts([]);
      setInvoiceForm({ supplierId: "", invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], currency: "EUR", notes: "" });
      router.refresh();
    });
  };

  const handlePost = (id: string) => {
    if (!confirm("Knjiženje fakture će povećati zalihe. Nastaviti?")) return;
    startTransition(async () => {
      await postInvoice(id);
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dobavljači i fakture</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {invoices.length} faktura · {suppliers.length} dobavljača
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSupplierForm(true)}
            className="flex items-center gap-2 border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <Building2 className="w-4 h-4" /> Novi dobavljač
          </button>
          <button onClick={() => setShowInvoiceForm(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
            <Plus className="w-4 h-4" /> Nova faktura
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: "invoices" as const, label: "Fakture", count: invoices.length },
          { key: "suppliers" as const, label: "Dobavljači", count: suppliers.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 transition-colors
              ${tab === t.key ? "border-black text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-black text-white" : "bg-muted text-muted-foreground"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Fakture tab */}
      {tab === "invoices" && (
        <div className="space-y-3">
          {invoices.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
              Nema faktura. Dodaj prvu fakturu dobavljača.
            </div>
          )}
          {invoices.map((inv) => {
            const isOpen = expandedInvoice === inv.id;
            return (
              <Card key={inv.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedInvoice(isOpen ? null : inv.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.supplier?.name ?? "—"} · {inv.invoiceDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">RSD {Number(inv.totalAmount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">{inv.items.length} stavki</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[inv.status] ?? "bg-gray-100"}`}>
                      {statusLabels[inv.status] ?? inv.status}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t p-4 space-y-4 bg-muted/10">
                    {/* Stavke */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Stavke</p>
                      <div className="space-y-1">
                        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-2">
                          <span className="col-span-5">Opis</span>
                          <span className="col-span-2 text-right">Kol.</span>
                          <span className="col-span-2 text-right">Jed. cena</span>
                          <span className="col-span-1 text-right">Alocir.</span>
                          <span className="col-span-2 text-right font-semibold">Realno</span>
                        </div>
                        {inv.items.map((item) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 text-sm px-2 py-1 rounded hover:bg-muted/30">
                            <span className="col-span-5 font-medium truncate">{item.description}</span>
                            <span className="col-span-2 text-right text-muted-foreground">{Number(item.quantity).toFixed(2)}</span>
                            <span className="col-span-2 text-right text-muted-foreground">RSD {Number(item.unitPrice).toFixed(2)}</span>
                            <span className="col-span-1 text-right text-muted-foreground text-xs">
                              +RSD {Number(item.allocatedAdditionalCost ?? 0).toFixed(2)}
                            </span>
                            <span className="col-span-2 text-right font-semibold text-green-700">
                              RSD {Number(item.finalUnitCost ?? item.unitPrice).toFixed(2)}/kom
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Troškovi */}
                    {inv.additionalCosts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Dodatni troškovi</p>
                        <div className="space-y-1">
                          {inv.additionalCosts.map((c) => (
                            <div key={c.id} className="flex justify-between text-sm px-2">
                              <span className="text-muted-foreground">
                                {costTypeLabels[c.costType] ?? c.costType}
                                {c.customsDutyRate ? ` (${c.customsDutyRate}%)` : ""}
                                {c.description ? ` — ${c.description}` : ""}
                              </span>
                              <span className="font-medium">RSD {Number(c.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sumarni red */}
                    <div className="border-t pt-3 flex items-center justify-between">
                      <div className="flex gap-6 text-sm">
                        <div><span className="text-muted-foreground">Roba: </span><span className="font-medium">RSD {Number(inv.subtotal).toFixed(2)}</span></div>
                        <div><span className="text-muted-foreground">Troškovi: </span><span className="font-medium">RSD {Number(inv.totalAdditionalCosts).toFixed(2)}</span></div>
                        <div><span className="text-muted-foreground">Ukupno: </span><span className="font-bold">RSD {Number(inv.totalAmount).toFixed(2)}</span></div>
                      </div>
                      {inv.status === "draft" && (
                        <button onClick={() => handlePost(inv.id)} disabled={isPending}
                          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 disabled:opacity-50">
                          <CheckCircle2 className="w-4 h-4" /> Knjiži fakturu
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dobavljači tab */}
      {tab === "suppliers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.length === 0 && (
            <div className="col-span-3 text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
              Nema dobavljača. Dodaj prvog dobavljača.
            </div>
          )}
          {suppliers.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.name}</p>
                    {s.contactPerson && <p className="text-xs text-muted-foreground">{s.contactPerson}</p>}
                    {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                    {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                    {s.country && <p className="text-xs text-muted-foreground">{s.country}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal — novi dobavljač */}
      {showSupplierForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Novi dobavljač</h2>
              <button onClick={() => setShowSupplierForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Naziv *</label>
                <Input required value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Kontakt osoba</label>
                  <Input value={supplierForm.contactPerson}
                    onChange={e => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Telefon</label>
                  <Input value={supplierForm.phone}
                    onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input type="email" value={supplierForm.email}
                  onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Zemlja</label>
                  <Input value={supplierForm.country}
                    onChange={e => setSupplierForm({ ...supplierForm, country: e.target.value })} className="mt-1" placeholder="npr. Turska" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">PIB</label>
                  <Input value={supplierForm.taxId}
                    onChange={e => setSupplierForm({ ...supplierForm, taxId: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSupplierForm(false)}
                  className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Sačuvaj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — nova faktura */}
      {showInvoiceForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Nova faktura dobavljača</h2>
              <button onClick={() => setShowInvoiceForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-5 space-y-6">
              {/* Osnovni podaci */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Dobavljač</label>
                  <select value={invoiceForm.supplierId}
                    onChange={e => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    <option value="">— bez dobavljača —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Broj fakture *</label>
                  <Input required value={invoiceForm.invoiceNumber}
                    onChange={e => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                    className="mt-1" placeholder="npr. INV-2024-001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Datum fakture *</label>
                  <Input required type="date" value={invoiceForm.invoiceDate}
                    onChange={e => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                    className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Valuta</label>
                  <select value={invoiceForm.currency}
                    onChange={e => setInvoiceForm({ ...invoiceForm, currency: e.target.value })}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    {["EUR", "USD", "GBP", "RSD", "TRY", "CNY"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Stavke */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Stavke robe</p>
                  <button type="button" onClick={addItem}
                    className="flex items-center gap-1 text-xs bg-muted px-3 py-1.5 rounded hover:bg-muted/80">
                    <Plus className="w-3 h-3" /> Dodaj stavku
                  </button>
                </div>
                {invoiceItems.length === 0 && (
                  <div className="border-2 border-dashed rounded-lg py-6 text-center text-sm text-muted-foreground">
                    Dodaj bar jednu stavku
                  </div>
                )}
                <div className="space-y-3">
                  {invoiceItems.map((item) => (
                    <div key={item._id} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                      {/* Tip artikla */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Materijal iz zaliha</label>
                          <select
                            value={item.materialId ?? ""}
                            onChange={e => {
                              const val = e.target.value;
                              updateItem(item._id, "materialId", val);
                              if (val) updateItem(item._id, "inventoryItemId", "");
                            }}
                            className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                            <option value="">— ručni unos —</option>
                            <optgroup label="Materijali">
                              {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </optgroup>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Ili gotova roba</label>
                          <select
                            value={item.inventoryItemId ?? ""}
                            onChange={e => {
                              const val = e.target.value;
                              updateItem(item._id, "inventoryItemId", val);
                              if (val) updateItem(item._id, "materialId", "");
                            }}
                            className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                            <option value="">—</option>
                            {inventoryItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Opis *</label>
                          <Input value={item.description} required
                            onChange={e => updateItem(item._id, "description", e.target.value)}
                            className="mt-1" placeholder="Naziv robe" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Količina</label>
                          <Input type="number" value={item.quantity} min="0.01" step="0.01"
                            onChange={e => updateItem(item._id, "quantity", Number(e.target.value))}
                            className="mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Jed. cena (RSD )</label>
                          <Input type="number" value={item.unitPrice} min="0" step="0.01"
                            onChange={e => updateItem(item._id, "unitPrice", Number(e.target.value))}
                            className="mt-1" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Ukupno: <strong>RSD {((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</strong>
                        </span>
                        <button type="button" onClick={() => removeItem(item._id)}
                          className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dodatni troškovi */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Dodatni troškovi</p>
                  <div className="flex gap-2">
                    {[
                      { type: "transport", label: "Transport" },
                      { type: "customs_duty", label: "Carina %" },
                      { type: "customs_fee", label: "Car. naknada" },
                      { type: "other", label: "Ostalo" },
                    ].map(({ type, label }) => (
                      <button key={type} type="button" onClick={() => addCost(type)}
                        className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {additionalCosts.map((cost, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50">
                      <span className="text-xs font-medium text-orange-700 shrink-0 w-28">
                        {costTypeLabels[cost.costType] ?? cost.costType}
                      </span>
                      {cost.costType === "customs_duty" ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input type="number" value={cost.customsDutyRate ?? ""} min="0" step="0.1"
                            onChange={e => updateCost(idx, "customsDutyRate", Number(e.target.value))}
                            className="w-24" placeholder="Stopa %" />
                          <span className="text-xs text-muted-foreground">%</span>
                          <span className="text-xs text-orange-700 ml-2">
                            = RSD {((subtotal * (cost.customsDutyRate ?? 0)) / 100).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <Input value={cost.description ?? ""}
                            onChange={e => updateCost(idx, "description", e.target.value)}
                            className="flex-1" placeholder="Opis (opciono)" />
                          <Input type="number" value={cost.amount} min="0" step="0.01"
                            onChange={e => updateCost(idx, "amount", Number(e.target.value))}
                            className="w-28" placeholder="Iznos RSD " />
                        </div>
                      )}
                      <button type="button" onClick={() => removeCost(idx)}
                        className="text-red-400 hover:text-red-600 shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kalkulacija */}
              {invoiceItems.length > 0 && (
                <div className="border rounded-xl p-4 bg-muted/30 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rekapitulacija</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Roba (subtotal)</span>
                    <span className="font-medium">RSD {subtotal.toFixed(2)}</span>
                  </div>
                  {additionalCosts.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dodatni troškovi</span>
                      <span className="font-medium text-orange-700">+ RSD {totalAdditional.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-2">
                    <span>Ukupno (landed cost)</span>
                    <span>RSD {totalAmount.toFixed(2)}</span>
                  </div>
                  {invoiceItems.length > 0 && subtotal > 0 && (
                    <div className="pt-1 space-y-1">
                      <p className="text-xs text-muted-foreground">Realno koštanje po stavci:</p>
                      {invoiceItems.map(item => {
                        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                        const proportion = subtotal > 0 ? itemTotal / subtotal : 0;
                        const allocated = totalAdditional * proportion;
                        const realCost = item.quantity > 0 ? (itemTotal + allocated) / item.quantity : item.unitPrice;
                        return (
                          <div key={item._id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground truncate max-w-[60%]">{item.description || "—"}</span>
                            <span className="font-medium text-green-700">RSD {realCost.toFixed(2)}/kom</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Napomene</label>
                <textarea value={invoiceForm.notes}
                  onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-16" />
              </div>

              <div className="flex gap-2 border-t pt-4">
                <button type="button" onClick={() => setShowInvoiceForm(false)}
                  className="flex-1 border rounded-md py-2.5 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending || invoiceItems.length === 0}
                  className="flex-1 bg-black text-white rounded-md py-2.5 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Sačuvaj fakturu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
