"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCustomer, importCustomers, generateCustomerTemplate } from "@/lib/actions/customers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Plus, X, Upload, Download, Merge, PhoneOff } from "lucide-react";
import Link from "next/link";
import type { Customer } from "@/lib/db/schema";

const tierColors: Record<string, string> = {
  Platinum: "bg-purple-100 text-purple-800",
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-100 text-gray-700",
  Bronze: "bg-orange-100 text-orange-800",
};

const emptyForm = {
  firstName: "", lastName: "", email: "", phone: "", city: "",
  vrat: "", grudi: "", struk: "", kuk: "", rame: "", rukav: "", duzina: "",
};

const PAGE_SIZE = 25;

interface CustomerStats {
  total: number;
  newThisMonth: number;
  loyalty: Record<string, number>;
}

export function CustomersClient({
  customers, total, q, page, stats, noPhone = false,
}: {
  customers: Customer[];
  total: number;
  q: string;
  page: number;
  stats: CustomerStats;
  noPhone?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Pretraga i paginacija idu preko URL-a — server vraća samo jednu stranicu
  // (4.000+ klijenata više ne putuje u browser)
  const [search, setSearch] = useState(q);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filterSuffix = noPhone ? "&noPhone=1" : "";

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) {
        router.replace(`/customers?q=${encodeURIComponent(search)}${filterSuffix}`);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search, q, router, filterSuffix]);

  const goToPage = (p: number) =>
    router.replace(`/customers?q=${encodeURIComponent(q)}&page=${p}${filterSuffix}`);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = customers;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        await createCustomer({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email || undefined,
          city: form.city || undefined,
          measurements: {
            vrat: form.vrat, grudi: form.grudi, struk: form.struk,
            kuk: form.kuk, rame: form.rame, rukav: form.rukav, duzina: form.duzina,
          },
        });
        setShowForm(false);
        setForm(emptyForm);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Greška pri dodavanju klijenta.");
      }
    });
  };

  const handleDownloadTemplate = () => {
    startTransition(async () => {
      const base64 = await generateCustomerTemplate();
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
      link.download = "template_klijenti.xlsx";
      link.click();
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const result = await importCustomers(fd);
      setImportResult(result);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  const platinum = stats.loyalty["Platinum"] ?? 0;
  const gold = stats.loyalty["Gold"] ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Klijenti</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {noPhone ? `${total} klijenata bez broja telefona` : `${stats.total} ukupno klijenata`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={noPhone ? "/customers" : "/customers?noPhone=1"}
            className={`flex items-center gap-2 border px-4 py-2 rounded-md text-sm transition-colors ${noPhone ? "bg-amber-100 border-amber-300 text-amber-800" : "hover:bg-muted"}`}>
            <PhoneOff className="w-4 h-4" /> {noPhone ? "Bez broja ✓" : "Bez broja"}
          </Link>
          <Link href="/customers/duplikati"
            className="flex items-center gap-2 border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <Merge className="w-4 h-4" /> Mogući duplikati
          </Link>
          <button onClick={handleDownloadTemplate} disabled={isPending}
            className="flex items-center gap-2 border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" /> Template
          </button>
          <label className={`flex items-center gap-2 border px-4 py-2 rounded-md text-sm cursor-pointer hover:bg-muted transition-colors ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload className="w-4 h-4" /> {isPending ? "Uvoz..." : "Uvezi Excel"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
            <Plus className="w-4 h-4" /> Novi klijent
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
              Uvezeno <strong>{importResult.inserted}</strong> novih klijenata.
              {importResult.skipped > 0 && ` Preskočeno ${importResult.skipped} (već postoje).`}
            </p>
            <button onClick={() => setImportResult(null)}
              className="w-full bg-black text-white rounded-md py-2 text-sm hover:bg-black/80">
              Zatvori
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Novi klijent</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ime *</label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required className="mt-1" placeholder="Marko" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Prezime *</label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required className="mt-1" placeholder="Petrović" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefon *</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="mt-1" placeholder="+382 67 123 456" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" placeholder="klijent@gmail.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Grad</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" placeholder="Podgorica" />
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Merenja (cm) — opciono</p>
                <div className="grid grid-cols-4 gap-2">
                  {(["vrat", "grudi", "struk", "kuk", "rame", "rukav", "duzina"] as const).map((m) => (
                    <div key={m}>
                      <label className="text-xs text-muted-foreground capitalize">{m}</label>
                      <Input
                        value={form[m]}
                        onChange={(e) => setForm({ ...form, [m]: e.target.value })}
                        className="mt-0.5 h-8 text-sm"
                        placeholder="00"
                      />
                    </div>
                  ))}
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending} className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Sačuvaj klijenta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ukupno", value: String(stats.total) },
          { label: "Platinum", value: String(platinum) },
          { label: "Gold", value: String(gold) },
          { label: "Novi ovaj mesec", value: String(stats.newThisMonth) },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold mt-0.5">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pretraži klijente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Klijent</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Kontakt</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Šablon</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Poslednji dolazak</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Ukupno potrošeno</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Lojalnost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="hover:underline">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-medium shrink-0">
                          {customer.firstName[0]}{customer.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{customer.firstName} {customer.lastName}</p>
                          <p className="text-xs text-muted-foreground">{customer.city}</p>
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{customer.phone}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono">{customer.templateNumber ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{customer.lastVisitDate ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{customer.visitCount} poseta</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">RSD {Number(customer.totalSpent).toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColors[customer.loyaltyTier] ?? "bg-gray-100 text-gray-700"}`}>
                      {customer.loyaltyTier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {q ? `Nema rezultata za "${q}"` : "Nema klijenata. Dodaj prvog!"}
            </div>
          )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} od {total}</span>
              <div className="flex gap-1">
                <button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded hover:bg-muted disabled:opacity-40 transition-colors">←</button>
                <span className="px-3 py-1">{page} / {totalPages}</span>
                <button onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="px-3 py-1 border rounded hover:bg-muted disabled:opacity-40 transition-colors">→</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
