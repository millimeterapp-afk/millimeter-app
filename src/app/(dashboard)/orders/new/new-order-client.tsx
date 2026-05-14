"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createOrder } from "@/lib/actions/orders";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type { Customer, Material } from "@/lib/db/schema";

const steps = ["Klijent", "Detalji", "Materijal", "Potvrda"];

const emptyForm = {
  customerId: "",
  item: "",
  material: "",
  dueDate: "",
  collar: "Klasična",
  sleeve: "Duga",
  fit: "Slim fit",
  notes: "",
  amount: "",
};

export function NewOrderClient({ customers, materials }: { customers: Customer[]; materials: Material[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") ?? "";

  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(preselectedCustomerId ? 1 : 0);
  const [form, setForm] = useState({ ...emptyForm, customerId: preselectedCustomerId });
  const [error, setError] = useState("");

  const selectedCustomer = customers.find(c => c.id === form.customerId);

  const handleSubmit = () => {
    setError("");
    startTransition(async () => {
      try {
        await createOrder({
          customerId: form.customerId,
          orderType: "custom",
          dueDate: form.dueDate || undefined,
          totalAmount: Number(form.amount) || 0,
          notes: form.notes || undefined,
          item: form.item,
          material: form.material || undefined,
          templateNumber: selectedCustomer?.templateNumber ?? undefined,
          collarType: form.collar,
          sleeveType: form.sleeve,
          fitType: form.fit,
        });
        router.push("/orders");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Greška pri kreiranju naloga.");
      }
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/orders" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="w-4 h-4" /> Nazad na naloge
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Novi nalog</h1>
        <p className="text-muted-foreground text-sm mt-1">Kreiranje naloga po meri</p>
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

      <div className="bg-white border rounded-xl p-6 space-y-4">
        {/* Korak 1 — Klijent */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-medium">Odaberi klijenta</h2>
            {customers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nema klijenata.</p>
                <Link href="/customers" className="text-sm text-black underline mt-1 inline-block">Dodaj klijenta →</Link>
              </div>
            )}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {customers.map((c) => (
                <button key={c.id} onClick={() => setForm({ ...form, customerId: c.id })}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors
                    ${form.customerId === c.id ? "border-black bg-black/5" : "border-transparent hover:bg-muted/50"}`}>
                  <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-medium shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground">{c.phone} · {c.templateNumber ?? "—"}</p>
                  </div>
                  {form.customerId === c.id && <Check className="w-4 h-4 ml-auto text-black" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Korak 2 — Detalji */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-medium">Detalji naloga</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Naziv artikla *</label>
              <Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} className="mt-1" placeholder="npr. Košulja bijela formal" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Kragla", key: "collar", options: ["Klasična", "Talijanska", "Button-down", "Mao", "Windsor"] },
                { label: "Rukav", key: "sleeve", options: ["Duga", "Kratka", "Dupla manžetna"] },
                { label: "Fit", key: "fit", options: ["Slim fit", "Regular fit", "Comfort fit"] },
              ].map(({ label, key, options }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <select value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    {options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rok isporuke</label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cena (€)</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1" placeholder="185" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Napomene</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-20"
                placeholder="Posebne instrukcije za produkciju..." />
            </div>
          </div>
        )}

        {/* Korak 3 — Materijal */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-medium">Odaberi materijal iz zaliha</h2>
            <div className="grid grid-cols-1 gap-2">
              {materials.filter(m => m.category === "Tkanina" || m.category === "Postava").map((m) => {
                const free = Number(m.currentStock) - Number(m.reservedStock);
                return (
                  <button key={m.id} onClick={() => setForm({ ...form, material: m.name })}
                    disabled={free <= 0}
                    className={`text-left flex items-center justify-between p-3 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                      ${form.material === m.name ? "border-black bg-black/5" : "border-muted hover:bg-muted/50"}`}>
                    <div>
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground ml-2 font-mono">{m.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{free} {m.unit} slobodno</span>
                      {form.material === m.name && <Check className="w-4 h-4 text-black" />}
                    </div>
                  </button>
                );
              })}
              <button onClick={() => setForm({ ...form, material: "" })}
                className={`text-left flex items-center p-3 rounded-lg border transition-colors
                  ${form.material === "" ? "border-black bg-black/5" : "border-muted hover:bg-muted/50"}`}>
                <span className="text-sm text-muted-foreground">Bez materijala / unijeti ručno</span>
                {form.material === "" && <Check className="w-4 h-4 text-black ml-auto" />}
              </button>
            </div>
          </div>
        )}

        {/* Korak 4 — Potvrda */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-medium">Potvrda naloga</h2>
            <div className="bg-muted/40 rounded-lg p-4 space-y-3">
              {[
                { label: "Klijent", value: `${selectedCustomer?.firstName} ${selectedCustomer?.lastName}` },
                { label: "Šablon broj", value: selectedCustomer?.templateNumber ?? "—" },
                { label: "Artikal", value: form.item },
                { label: "Materijal", value: form.material || "—" },
                { label: "Kragla / Rukav / Fit", value: `${form.collar} / ${form.sleeve} / ${form.fit}` },
                { label: "Rok isporuke", value: form.dueDate || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-muted-foreground">Cena</span>
                <span className="font-bold text-base">€{form.amount || "—"}</span>
              </div>
            </div>
            {form.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <strong>Napomena:</strong> {form.notes}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="flex items-center gap-2 border px-4 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" /> Nazad
          </button>
        )}
        <div className="flex-1" />
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={step === 0 && !form.customerId}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors disabled:opacity-40">
            Dalje <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={isPending || !form.item || !form.customerId}
            className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-md text-sm hover:bg-black/80 transition-colors disabled:opacity-40">
            <Check className="w-4 h-4" /> {isPending ? "Kreiranje..." : "Potvrdi nalog"}
          </button>
        )}
      </div>
    </div>
  );
}
