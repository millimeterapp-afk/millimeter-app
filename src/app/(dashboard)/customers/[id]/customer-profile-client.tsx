"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer, saveMeasurements, addHistoricalPurchase } from "@/lib/actions/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Phone, Mail, MapPin, Ruler, Star, ClipboardList, Wrench, Check, Pencil, Plus, History, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";
import type { Customer, CustomerMeasurement, Order, Correction, Appointment } from "@/lib/db/schema";

type CustomerWithDetails = Customer & {
  measurements: CustomerMeasurement[];
  orders: Order[];
  corrections: Correction[];
};

const typeLabels: Record<string, string> = {
  merenje: "Merenje", proba: "Proba", isporuka: "Isporuka",
  konsultacija: "Konsultacija", ostalo: "Ostalo",
};

const typeColors: Record<string, string> = {
  merenje: "bg-blue-100 text-blue-800",
  proba: "bg-purple-100 text-purple-800",
  isporuka: "bg-green-100 text-green-800",
  konsultacija: "bg-yellow-100 text-yellow-800",
  ostalo: "bg-gray-100 text-gray-700",
};

const apptStatusLabels: Record<string, string> = {
  scheduled: "Zakazano", completed: "Obavljeno",
  cancelled: "Otkazano", no_show: "Nije došao",
};

const apptStatusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
  no_show: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  confirmed: "Potvrđen",
  in_production: "U produkciji",
  ready: "Gotov",
  delivered: "Isporučen",
  cancelled: "Otkazan",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-800",
  in_production: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-700",
};

const tierColors: Record<string, string> = {
  Platinum: "bg-purple-100 text-purple-800",
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-100 text-gray-700",
  Bronze: "bg-orange-100 text-orange-800",
};

const correctionStatusLabels: Record<string, string> = {
  open: "Otvoreno",
  in_production: "U produkciji",
  resolved: "Rešeno",
  not_resolved: "Nije rešeno",
};

const correctionStatusColors: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_production: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  not_resolved: "bg-red-100 text-red-700",
};

export function CustomerProfileClient({ customer, appointments }: { customer: CustomerWithDetails; appointments: Appointment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email ?? "",
    city: customer.city ?? "",
    templateNumber: customer.templateNumber ?? "",
    notes: customer.notes ?? "",
  });

  const measurements = customer.measurements[0]?.data as Record<string, string> | undefined;

  const measurementFields = [
    { key: "vrat", label: "Vrat" },
    { key: "grudi", label: "Grudi" },
    { key: "struk", label: "Struk" },
    { key: "kuk", label: "Kuk" },
    { key: "rame", label: "Rame" },
    { key: "rukav", label: "Rukav" },
    { key: "duzina", label: "Dužina" },
    { key: "stomak", label: "Stomak" },
  ];

  const [showMeasEdit, setShowMeasEdit] = useState(false);
  const [measForm, setMeasForm] = useState<Record<string, string>>(
    measurements ?? Object.fromEntries(measurementFields.map(f => [f.key, ""]))
  );

  const [showHistorical, setShowHistorical] = useState(false);
  const [historicalForm, setHistoricalForm] = useState({ item: "", totalAmount: "", deliveredAt: "", notes: "" });
  const [historicalError, setHistoricalError] = useState("");

  const handleAddHistorical = () => {
    if (!historicalForm.item || !historicalForm.totalAmount || !historicalForm.deliveredAt) return;
    setHistoricalError("");
    startTransition(async () => {
      try {
        await addHistoricalPurchase(customer.id, {
          item: historicalForm.item,
          totalAmount: Number(historicalForm.totalAmount),
          deliveredAt: historicalForm.deliveredAt,
          notes: historicalForm.notes || undefined,
        });
        setHistoricalForm({ item: "", totalAmount: "", deliveredAt: "", notes: "" });
        setShowHistorical(false);
        router.refresh();
      } catch (e) {
        setHistoricalError(e instanceof Error ? e.message : "Greška");
      }
    });
  };

  const handleSaveMeasurements = () => {
    startTransition(async () => {
      await saveMeasurements(customer.id, measForm);
      setShowMeasEdit(false);
      router.refresh();
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateCustomer(customer.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email || undefined,
        city: form.city || undefined,
        templateNumber: form.templateNumber || undefined,
        notes: form.notes || undefined,
      });
      setEditMode(false);
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/customers" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="w-4 h-4" /> Nazad na klijente
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-semibold shrink-0">
            {customer.firstName[0]}{customer.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{customer.firstName} {customer.lastName}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {customer.templateNumber && (
                <span className="text-sm text-muted-foreground font-mono">{customer.templateNumber}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierColors[customer.loyaltyTier] ?? "bg-gray-100"}`}>
                {customer.loyaltyTier}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-2 border px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <Pencil className="w-4 h-4" /> {editMode ? "Otkaži" : "Uredi"}
          </button>
          <Link href={`/orders/new?customerId=${customer.id}`} className="text-sm bg-black text-white px-4 py-2 rounded-md hover:bg-black/80 transition-colors">
            + Novi nalog
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leva kolona */}
        <div className="space-y-4">
          {/* Kontakt / Edit */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kontakt</CardTitle>
              {editMode && (
                <button onClick={handleSave} disabled={isPending}
                  className="flex items-center gap-1 text-xs bg-black text-white px-3 py-1.5 rounded hover:bg-black/80 disabled:opacity-50">
                  <Check className="w-3 h-3" /> Sačuvaj
                </button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {editMode ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Ime</label>
                      <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Prezime</label>
                      <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Telefon</label>
                    <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Email</label>
                    <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Grad</label>
                    <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Šablon broj</label>
                    <Input value={form.templateNumber} onChange={e => setForm({ ...form, templateNumber: e.target.value })} className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Napomene</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-16" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.city && (
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{customer.city}</span>
                    </div>
                  )}
                  {customer.notes && (
                    <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{customer.notes}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Statistika */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Statistika</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ukupno potrošeno</span>
                <span className="font-semibold">RSD {Number(customer.totalSpent).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Broj poseta</span>
                <span className="font-medium">{customer.visitCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prva poseta</span>
                <span>{customer.firstVisitDate ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Poslednja poseta</span>
                <span>{customer.lastVisitDate ?? "—"}</span>
              </div>
              <div className="pt-2 border-t flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500" /> Loyalty poeni
                </span>
                <span className="font-semibold text-yellow-600">{customer.loyaltyPoints} pt</span>
              </div>
            </CardContent>
          </Card>

          {/* Merenja */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Merenja (cm)
              </CardTitle>
              <button onClick={() => setShowMeasEdit(!showMeasEdit)}
                className="text-xs border px-2 py-1 rounded hover:bg-muted transition-colors flex items-center gap-1">
                <Pencil className="w-3 h-3" /> {showMeasEdit ? "Otkaži" : "Uredi"}
              </button>
            </CardHeader>
            <CardContent>
              {showMeasEdit ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {measurementFields.map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground">{label}</label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={measForm[key] ?? ""}
                            onChange={(e) => setMeasForm({ ...measForm, [key]: e.target.value })}
                            className="h-8 text-sm pr-8"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">cm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveMeasurements} disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 bg-black text-white py-2 rounded-md text-sm hover:bg-black/80 disabled:opacity-50">
                    <Check className="w-4 h-4" /> Sačuvaj merenja
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {measurementFields.map(({ key, label }) => {
                    const val = measurements?.[key];
                    return (
                      <div key={key} className="bg-muted/50 rounded-md p-2.5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold mt-0.5">
                          {val && val !== "—" ? `${val} cm` : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Desna kolona */}
        <div className="lg:col-span-2 space-y-4">
          {/* Istorija naloga */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Istorija naloga
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{customer.orders.length} naloga</span>
                <button
                  onClick={() => setShowHistorical(!showHistorical)}
                  className="flex items-center gap-1 text-xs border px-2 py-1 rounded hover:bg-muted transition-colors"
                  title="Retroaktivni unos kupovine"
                >
                  <History className="w-3.5 h-3.5" /> Retroaktivno
                </button>
              </div>
            </CardHeader>
            {showHistorical && (
              <div className="px-4 pb-4 border-b">
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                  <History className="w-3.5 h-3.5" /> Unos prethodnih kupovina (papirna evidencija)
                </p>
                {historicalError && (
                  <p className="text-xs text-red-600 mb-2">{historicalError}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Artikal / Opis *</label>
                    <Input value={historicalForm.item} onChange={e => setHistoricalForm({ ...historicalForm, item: e.target.value })}
                      className="mt-1 h-8 text-sm" placeholder="npr. Košulja po meri" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Iznos (RSD ) *</label>
                    <Input type="number" value={historicalForm.totalAmount} onChange={e => setHistoricalForm({ ...historicalForm, totalAmount: e.target.value })}
                      className="mt-1 h-8 text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Datum isporuke *</label>
                    <Input type="date" value={historicalForm.deliveredAt} onChange={e => setHistoricalForm({ ...historicalForm, deliveredAt: e.target.value })}
                      className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Napomena</label>
                    <Input value={historicalForm.notes} onChange={e => setHistoricalForm({ ...historicalForm, notes: e.target.value })}
                      className="mt-1 h-8 text-sm" placeholder="opciono" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleAddHistorical} disabled={isPending || !historicalForm.item || !historicalForm.totalAmount || !historicalForm.deliveredAt}
                    className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded text-xs hover:bg-black/80 disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" /> Dodaj kupovinu
                  </button>
                  <button onClick={() => setShowHistorical(false)} className="text-xs text-muted-foreground hover:text-foreground px-2">
                    Otkaži
                  </button>
                </div>
              </div>
            )}
            <CardContent className="p-0">
              {customer.orders.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Nalog</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Datum</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Artikal</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Status</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Iznos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/orders/${order.id}`}
                            className="text-xs font-mono text-muted-foreground hover:underline">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(order.createdAt).toLocaleDateString("sr-RS")}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{order.item ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.orderType === "custom" ? "Po meri" : order.orderType === "ready_made" ? "Gotova roba" : "Korekcija"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] ?? "bg-gray-100"}`}>
                            {statusLabels[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {Number(order.totalAmount) > 0 ? `RSD ${Number(order.totalAmount).toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">Nema naloga</div>
              )}
            </CardContent>
          </Card>

          {/* Korekcije */}
          {customer.corrections.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Korekcije ({customer.corrections.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {customer.corrections.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.correctionType}</span>
                        {c.affectsTemplate && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Šablon</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("sr-RS")}
                        </span>
                      </div>
                      <p className="text-sm">{c.description}</p>
                      {c.cause && <p className="text-xs text-muted-foreground mt-0.5">{c.cause}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${correctionStatusColors[c.status] ?? "bg-gray-100"}`}>
                      {correctionStatusLabels[c.status] ?? c.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Termini */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Termini ({appointments.length})
              </CardTitle>
              <Link href={`/appointments`}
                className="text-xs text-muted-foreground hover:underline">
                Svi termini →
              </Link>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nema zakazanih termina</p>
              ) : (
                <div className="space-y-2">
                  {appointments.slice(0, 6).map((a) => {
                    const dt = new Date(a.scheduledAt);
                    const isPast = dt < new Date();
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`text-xs px-2 py-1 rounded font-medium shrink-0 ${typeColors[a.type] ?? "bg-gray-100 text-gray-700"}`}>
                            {typeLabels[a.type] ?? a.type}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className={isPast ? "text-muted-foreground" : "text-foreground font-medium"}>
                                {dt.toLocaleDateString("sr-RS")} u {dt.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {a.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{a.notes}</p>}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${apptStatusColors[a.status] ?? "bg-gray-100"}`}>
                          {apptStatusLabels[a.status] ?? a.status}
                        </span>
                      </div>
                    );
                  })}
                  {appointments.length > 6 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      + još {appointments.length - 6} termina
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
