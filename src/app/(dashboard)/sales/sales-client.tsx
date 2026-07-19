"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSale } from "@/lib/actions/sales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, X, ShoppingCart, Check, Plus, Package } from "lucide-react";
import type { Customer, InventoryItem, Sale, SaleItem } from "@/lib/db/schema";

type SaleWithDetails = Sale & {
  customer: Customer | null;
  items: SaleItem[];
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  inventoryItemId?: string;
};

const paymentMethods = [
  { id: "cash" as const, label: "Gotovina" },
  { id: "card" as const, label: "Kartica" },
  { id: "transfer" as const, label: "Transfer" },
];

export function SalesClient({
  customers,
  inventoryItems,
  recentSales,
}: {
  customers: Customer[];
  inventoryItems: InventoryItem[];
  recentSales: SaleWithDetails[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [payment, setPayment] = useState<"cash" | "card" | "transfer">("cash");
  const [success, setSuccess] = useState(false);

  // Ručni unos artikla koji nije u inventaru
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");

  const filtered = inventoryItems.filter(
    (i) =>
      (i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.category ?? "").toLowerCase().includes(search.toLowerCase())) &&
      (i.quantity - i.reservedQuantity) > 0
  );

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryItemId === item.id);
      if (existing) return prev.map((c) => c.inventoryItemId === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        id: item.id,
        name: item.name,
        price: Number(item.salePrice ?? 0),
        qty: 1,
        inventoryItemId: item.id,
      }];
    });
  };

  const addManual = () => {
    if (!manualName || !manualPrice) return;
    setCart((prev) => [...prev, {
      id: `manual-${Date.now()}`,
      name: manualName,
      price: Number(manualPrice),
      qty: 1,
    }]);
    setManualName("");
    setManualPrice("");
    setShowManual(false);
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return removeFromCart(id);
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, qty } : c));
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);

  const [saleError, setSaleError] = useState("");

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setSaleError("");
    startTransition(async () => {
      try {
        await createSale({
          customerId: customerId || undefined,
          paymentMethod: payment,
          items: cart.map((c) => ({
            itemName: c.name,
            inventoryItemId: c.inventoryItemId,
            quantity: c.qty,
            unitPrice: c.price,
            totalPrice: c.price * c.qty,
          })),
        });
        setCart([]);
        setCustomerId("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        router.refresh();
      } catch (e) {
        setSaleError(e instanceof Error ? e.message : "Greška pri evidenciji prodaje.");
      }
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prodaja</h1>
        <p className="text-muted-foreground text-sm mt-1">Prodaja gotove robe</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 flex items-center gap-2 text-sm font-medium">
          <Check className="w-4 h-4" /> Prodaja uspješno evidentirana!
        </div>
      )}
      {saleError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {saleError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Levo — lista artikala */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži artikle iz zaliha..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-2 border px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" /> Ručno
            </button>
          </div>

          {/* Ručni unos */}
          {showManual && (
            <div className="flex gap-2 p-3 bg-muted/40 rounded-lg border">
              <Input
                placeholder="Naziv artikla"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Cena (RSD )"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-28 h-8 text-sm"
              />
              <button
                onClick={addManual}
                disabled={!manualName || !manualPrice}
                className="bg-black text-white px-3 py-1.5 rounded-md text-xs hover:bg-black/80 disabled:opacity-40"
              >
                Dodaj
              </button>
            </div>
          )}

          {inventoryItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nema artikala u zalihi</p>
              <p className="text-xs mt-1">Dodaj gotovu robu u <a href="/inventory" className="underline">Zalihe</a></p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((item) => {
                const inCart = cart.find((c) => c.inventoryItemId === item.id);
                const free = item.quantity - item.reservedQuantity;
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`text-left p-3 rounded-lg border transition-all hover:shadow-sm ${inCart ? "border-black bg-black/5" : "border-muted hover:border-black/20"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.category ?? "—"} · {free} kom
                        </p>
                      </div>
                      {inCart && (
                        <span className="text-xs bg-black text-white rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-2">
                          {inCart.qty}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold mt-2">RSD {Number(item.salePrice ?? 0).toLocaleString()}</p>
                  </button>
                );
              })}
              {filtered.length === 0 && search && (
                <p className="col-span-2 text-center py-6 text-sm text-muted-foreground">Nema rezultata za &quot;{search}&quot;</p>
              )}
            </div>
          )}
        </div>

        {/* Desno — korpa i naplata */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Korpa {cart.length > 0 && `(${cart.reduce((s, c) => s + c.qty, 0)} art.)`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Klikni na artikal da ga dodaš</p>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">RSD {item.price} × {item.qty}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          className="w-6 h-6 rounded border text-xs hover:bg-muted flex items-center justify-center"
                        >−</button>
                        <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          className="w-6 h-6 rounded border text-xs hover:bg-muted flex items-center justify-center"
                        >+</button>
                        <button onClick={() => removeFromCart(item.id)} className="ml-1 text-muted-foreground hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t flex justify-between text-base font-bold">
                    <span>Ukupno</span>
                    <span>RSD {total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Klijent */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Klijent (opciono)</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                >
                  <option value="">Anonimna prodaja</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Način plaćanja */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Način plaćanja</label>
                <div className="flex gap-2 mt-1">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayment(m.id)}
                      className={`flex-1 py-2 text-xs rounded-md border transition-colors font-medium
                        ${payment === m.id ? "bg-black text-white border-black" : "hover:bg-muted"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isPending}
                className="w-full bg-black text-white py-2.5 rounded-md text-sm font-medium hover:bg-black/80 transition-colors disabled:opacity-40"
              >
                {isPending ? "Čuvanje..." : `Naplati RSD ${total.toLocaleString()}`}
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Nedavne prodaje */}
      <div>
        <h2 className="text-base font-semibold mb-3">Nedavne prodaje</h2>
        <Card>
          <CardContent className="p-0">
            {recentSales.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Nema evidentiranih prodaja</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[550px]">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Broj</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Klijent</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Artikala</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Plaćanje</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Datum</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Iznos</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{s.saleNumber}</td>
                      <td className="px-4 py-3 text-sm">
                        {s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{s.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          {s.paymentMethod === "cash" ? "Gotovina" : s.paymentMethod === "card" ? "Kartica" : "Transfer"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(s.createdAt).toLocaleDateString("sr-RS")}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold">RSD {Number(s.totalAmount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
