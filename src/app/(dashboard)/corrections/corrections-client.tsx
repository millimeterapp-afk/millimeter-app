"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCorrection, updateCorrectionStatus } from "@/lib/actions/corrections";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerPicker } from "@/components/customer-picker";
import { Plus, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Correction } from "@/lib/db/schema";

type CorrectionRow = Correction & {
  customer: { id: string; firstName: string; lastName: string } | null;
  order: { id: string; orderNumber: string; item: string | null } | null;
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_production: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  not_resolved: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, string> = {
  open: "Otvorena",
  in_production: "U produkciji",
  resolved: "Rešeno",
  not_resolved: "Nije rešeno",
};

const emptyForm = {
  customerId: "", orderId: "", correctionType: "Rukav",
  description: "", dueDate: "", affectsTemplate: false, templateNote: "",
};

export function CorrectionsClient({
  corrections,
}: {
  corrections: CorrectionRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; label: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("open");

  const tabs = [
    { key: "open", label: "Otvorene", count: corrections.filter(c => c.status === "open").length },
    { key: "in_production", label: "U produkciji", count: corrections.filter(c => c.status === "in_production").length },
    { key: "resolved", label: "Rešene", count: corrections.filter(c => c.status === "resolved").length },
    { key: "all", label: "Sve", count: corrections.length },
  ];

  const filtered = statusFilter === "all" ? corrections : corrections.filter(c => c.status === statusFilter);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createCorrection({
        customerId: selectedCustomer?.id || undefined,
        orderId: form.orderId || undefined,
        correctionType: form.correctionType,
        description: form.description,
        dueDate: form.dueDate || undefined,
        affectsTemplate: form.affectsTemplate,
        templateNote: form.templateNote || undefined,
      });
      setShowForm(false);
      setForm(emptyForm);
      setSelectedCustomer(null);
      router.refresh();
    });
  };

  const handleStatusChange = (id: string, status: "open" | "in_production" | "resolved" | "not_resolved") => {
    startTransition(async () => {
      await updateCorrectionStatus(id, status);
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Korekcije</h1>
          <p className="text-muted-foreground text-sm mt-1">{corrections.length} evidentirane korekcije</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
          <Plus className="w-4 h-4" /> Nova korekcija
        </button>
      </div>

      {/* Status tabovi */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5
              ${statusFilter === tab.key ? "border-black text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? "bg-black text-white" : "bg-muted text-muted-foreground"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ukupno", value: corrections.length, color: "" },
          { label: "Otvorene", value: corrections.filter(c => c.status === "open").length, color: "text-red-600" },
          { label: "U produkciji", value: corrections.filter(c => c.status === "in_production").length, color: "text-yellow-600" },
          { label: "Rešene", value: corrections.filter(c => c.status === "resolved").length, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Nova korekcija</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Klijent</label>
                <div className="mt-1">
                  <CustomerPicker value={selectedCustomer} onChange={setSelectedCustomer} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tip korekcije</label>
                <select value={form.correctionType} onChange={(e) => setForm({ ...form, correctionType: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  {["Rukav", "Kragna", "Grudi", "Struk", "Dužina", "Ramena", "Ostalo"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Opis korekcije *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-20"
                  placeholder="Detaljno opišite šta treba popraviti..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rok korekcije</label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.affectsTemplate}
                  onChange={(e) => setForm({ ...form, affectsTemplate: e.target.checked })} className="rounded" />
                <span className="text-sm">Utiče na šablon klijenta</span>
              </label>
              {form.affectsTemplate && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Napomena za šablon</label>
                  <Input value={form.templateNote} onChange={(e) => setForm({ ...form, templateNote: e.target.value })}
                    className="mt-1" placeholder="Šta promeniti u šablonu..." />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Sačuvaj korekciju"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((c) => {
          const customer = c.customer;
          const order = c.order;
          return (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.correctionType}</span>
                      {c.affectsTemplate && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Utiče na šablon</span>
                      )}
                      {c.dueDate && (
                        <span className="text-xs text-muted-foreground">Rok: {c.dueDate}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {customer && (
                        <Link href={`/customers/${customer.id}`} className="text-sm font-medium hover:underline flex items-center gap-1">
                          {customer.firstName} {customer.lastName}
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </Link>
                      )}
                      {order && (
                        <Link href={`/orders/${order.id}`} className="text-xs font-mono text-muted-foreground hover:underline flex items-center gap-1">
                          {order.orderNumber}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    {c.templateNote && (
                      <p className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1 mt-1">
                        Šablon: {c.templateNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[c.status] ?? "bg-gray-100"}`}>
                      {statusLabels[c.status] ?? c.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.createdAt.toISOString().split("T")[0]}</span>
                    {c.status === "open" && (
                      <div className="flex gap-1">
                        <button onClick={() => handleStatusChange(c.id, "in_production")}
                          className="text-xs border px-2 py-0.5 rounded hover:bg-muted">U produkciju</button>
                        <button onClick={() => handleStatusChange(c.id, "resolved")}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">Rešeno</button>
                      </div>
                    )}
                    {c.status === "in_production" && (
                      <div className="flex gap-1">
                        <button onClick={() => handleStatusChange(c.id, "resolved")}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">Rešeno ✓</button>
                        <button onClick={() => handleStatusChange(c.id, "not_resolved")}
                          className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded hover:bg-red-200">Nije rešeno</button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
            {statusFilter === "all" ? "Nema korekcija." : `Nema korekcija u statusu "${tabs.find(t => t.key === statusFilter)?.label}".`}
          </div>
        )}
      </div>
    </div>
  );
}
