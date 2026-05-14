"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAppointment, updateAppointmentStatus, updateAppointment, deleteAppointment,
} from "@/lib/actions/appointments";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, X, ChevronLeft, ChevronRight, Clock, User, Check, XCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Appointment, Customer } from "@/lib/db/schema";

type AppointmentWithCustomer = Appointment & { customer: Customer | null };

const TYPES = ["merenje", "proba", "isporuka", "konsultacija", "ostalo"];

const typeColors: Record<string, string> = {
  merenje: "bg-blue-100 text-blue-800",
  proba: "bg-purple-100 text-purple-800",
  isporuka: "bg-green-100 text-green-800",
  konsultacija: "bg-yellow-100 text-yellow-800",
  ostalo: "bg-gray-100 text-gray-700",
};

const typeLabels: Record<string, string> = {
  merenje: "Merenje",
  proba: "Proba",
  isporuka: "Isporuka",
  konsultacija: "Konsultacija",
  ostalo: "Ostalo",
};

const statusColors: Record<string, string> = {
  scheduled: "border-l-blue-400",
  completed: "border-l-green-400",
  cancelled: "border-l-gray-300",
  no_show: "border-l-red-400",
};

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00–20:00

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getWeekDays(base: Date): Date[] {
  const monday = new Date(base);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const emptyForm = {
  customerId: "", scheduledAt: "", durationMinutes: 60, type: "merenje", notes: "",
};

export function AppointmentsClient({
  appointments, customers,
}: {
  appointments: AppointmentWithCustomer[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"week" | "list">("week");
  const [baseDate, setBaseDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const weekDays = getWeekDays(baseDate);
  const today = new Date();

  const prevWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d); };
  const nextWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.scheduledAt) return;
    startTransition(async () => {
      await createAppointment({
        customerId: form.customerId || undefined,
        scheduledAt: form.scheduledAt,
        durationMinutes: form.durationMinutes,
        type: form.type,
        notes: form.notes || undefined,
      });
      setShowForm(false);
      setForm(emptyForm);
      router.refresh();
    });
  };

  const handleStatusChange = (id: string, status: "completed" | "cancelled" | "no_show") => {
    startTransition(async () => {
      await updateAppointmentStatus(id, status);
      router.refresh();
    });
  };

  const handleEdit = (appt: AppointmentWithCustomer) => {
    setEditId(appt.id);
    const dt = new Date(appt.scheduledAt);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 16);
    setEditForm({
      customerId: appt.customerId ?? "",
      scheduledAt: local,
      durationMinutes: appt.durationMinutes,
      type: appt.type,
      notes: appt.notes ?? "",
    });
  };

  const handleSaveEdit = () => {
    if (!editId) return;
    startTransition(async () => {
      await updateAppointment(editId, {
        customerId: editForm.customerId || undefined,
        scheduledAt: editForm.scheduledAt,
        durationMinutes: editForm.durationMinutes,
        type: editForm.type,
        notes: editForm.notes,
      });
      setEditId(null);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Obrisati termin?")) return;
    startTransition(async () => {
      await deleteAppointment(id);
      router.refresh();
    });
  };

  // Upcoming (scheduled, not cancelled) for list view
  const upcoming = appointments
    .filter(a => a.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const past = appointments
    .filter(a => a.status !== "scheduled")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const todayCount = appointments.filter(a =>
    isSameDay(new Date(a.scheduledAt), today) && a.status === "scheduled"
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Termini</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {todayCount > 0
              ? `${todayCount} termin${todayCount > 1 ? "a" : ""} danas`
              : "Nema termina danas"}
            {" · "}{appointments.filter(a => a.status === "scheduled").length} zakazanih ukupno
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md overflow-hidden text-sm">
            <button onClick={() => setView("week")}
              className={`px-3 py-1.5 transition-colors ${view === "week" ? "bg-black text-white" : "hover:bg-muted"}`}>
              Sedmica
            </button>
            <button onClick={() => setView("list")}
              className={`px-3 py-1.5 transition-colors ${view === "list" ? "bg-black text-white" : "hover:bg-muted"}`}>
              Lista
            </button>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80">
            <Plus className="w-4 h-4" /> Novi termin
          </button>
        </div>
      </div>

      {/* Sedmični prikaz */}
      {view === "week" && (
        <div className="space-y-3">
          {/* Navigacija */}
          <div className="flex items-center gap-3">
            <button onClick={prevWeek} className="p-1.5 border rounded hover:bg-muted">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">
              {weekDays[0].toLocaleDateString("sr-Latn", { day: "numeric", month: "long" })}
              {" — "}
              {weekDays[6].toLocaleDateString("sr-Latn", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <button onClick={nextWeek} className="p-1.5 border rounded hover:bg-muted">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setBaseDate(new Date())}
              className="text-xs text-muted-foreground border px-2 py-1 rounded hover:bg-muted ml-1">
              Danas
            </button>
          </div>

          {/* Grid */}
          <div className="border rounded-xl overflow-hidden">
            {/* Dan header */}
            <div className="grid grid-cols-8 border-b">
              <div className="py-2 px-3 text-xs text-muted-foreground" />
              {weekDays.map((day) => {
                const isToday = isSameDay(day, today);
                return (
                  <div key={day.toISOString()}
                    className={`py-2 text-center border-l ${isToday ? "bg-black text-white" : ""}`}>
                    <p className="text-xs text-muted-foreground" style={{ color: isToday ? "rgba(255,255,255,0.7)" : "" }}>
                      {day.toLocaleDateString("sr-Latn", { weekday: "short" })}
                    </p>
                    <p className={`text-sm font-semibold ${isToday ? "text-white" : ""}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Sati */}
            <div className="overflow-y-auto max-h-[520px]">
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b min-h-[56px]">
                  <div className="py-1 px-3 text-xs text-muted-foreground text-right pt-1 shrink-0">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((day) => {
                    const dayAppts = appointments.filter((a) => {
                      const dt = new Date(a.scheduledAt);
                      return isSameDay(dt, day) && dt.getHours() === hour;
                    });
                    return (
                      <div key={day.toISOString()}
                        className="border-l py-0.5 px-0.5 min-h-[56px] relative hover:bg-muted/20 cursor-pointer"
                        onClick={() => {
                          const dt = new Date(day);
                          dt.setHours(hour, 0, 0, 0);
                          const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
                            .toISOString().slice(0, 16);
                          setForm({ ...emptyForm, scheduledAt: local });
                          setShowForm(true);
                        }}>
                        {dayAppts.map((appt) => (
                          <div key={appt.id}
                            className={`text-xs px-1.5 py-1 rounded border-l-2 mb-0.5 cursor-pointer
                              ${appt.status === "cancelled" ? "bg-gray-50 opacity-50" : "bg-white shadow-sm"}
                              ${statusColors[appt.status] ?? "border-l-gray-300"}`}
                            onClick={(e) => { e.stopPropagation(); handleEdit(appt); }}>
                            <p className="font-medium truncate">
                              {appt.customer
                                ? `${appt.customer.firstName} ${appt.customer.lastName}`
                                : "Bez klijenta"}
                            </p>
                            <p className="text-muted-foreground">{typeLabels[appt.type] ?? appt.type}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista prikaz */}
      {view === "list" && (
        <div className="space-y-6">
          {/* Predstojeći */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Predstojeći ({upcoming.length})
            </h2>
            {upcoming.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
                Nema zakazanih termina
              </div>
            )}
            <div className="space-y-2">
              {upcoming.map(appt => (
                <AppointmentCard key={appt.id} appt={appt} customers={customers}
                  onStatusChange={handleStatusChange} onEdit={handleEdit} onDelete={handleDelete}
                  isPending={isPending} />
              ))}
            </div>
          </div>

          {/* Prošli */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Prošli ({past.length})
              </h2>
              <div className="space-y-2">
                {past.slice(0, 10).map(appt => (
                  <AppointmentCard key={appt.id} appt={appt} customers={customers}
                    onStatusChange={handleStatusChange} onEdit={handleEdit} onDelete={handleDelete}
                    isPending={isPending} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal — novi termin */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Novi termin</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Klijent</label>
                <select value={form.customerId}
                  onChange={e => setForm({ ...form, customerId: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="">— bez klijenta —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Datum i vreme *</label>
                  <Input required type="datetime-local" value={form.scheduledAt}
                    onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
                    className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Trajanje (min)</label>
                  <select value={form.durationMinutes}
                    onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    {[15, 30, 45, 60, 90, 120].map(m => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tip termina</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {TYPES.map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors
                        ${form.type === t ? "bg-black text-white border-black" : "hover:bg-muted"}`}>
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Napomena</label>
                <textarea value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-16"
                  placeholder="Opciono..." />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "Čuvanje..." : "Zakaži termin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — edit termina */}
      {editId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Uredi termin</h2>
              <button onClick={() => setEditId(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Klijent</label>
                <select value={editForm.customerId}
                  onChange={e => setEditForm({ ...editForm, customerId: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  <option value="">— bez klijenta —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Datum i vreme</label>
                  <Input type="datetime-local" value={editForm.scheduledAt}
                    onChange={e => setEditForm({ ...editForm, scheduledAt: e.target.value })}
                    className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Trajanje (min)</label>
                  <select value={editForm.durationMinutes}
                    onChange={e => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                    className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    {[15, 30, 45, 60, 90, 120].map(m => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tip termina</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {TYPES.map(t => (
                    <button key={t} type="button"
                      onClick={() => setEditForm({ ...editForm, type: t })}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors
                        ${editForm.type === t ? "bg-black text-white border-black" : "hover:bg-muted"}`}>
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Napomena</label>
                <textarea value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-16" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditId(null)}
                  className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                <button onClick={handleSaveEdit} disabled={isPending}
                  className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                  {isPending ? "..." : "Sačuvaj"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({
  appt, customers, onStatusChange, onEdit, onDelete, isPending,
}: {
  appt: AppointmentWithCustomer;
  customers: Customer[];
  onStatusChange: (id: string, s: "completed" | "cancelled" | "no_show") => void;
  onEdit: (a: AppointmentWithCustomer) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  const dt = new Date(appt.scheduledAt);
  const dateStr = dt.toLocaleDateString("sr-Latn", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = dt.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" });
  const isScheduled = appt.status === "scheduled";

  return (
    <Card className={`border-l-4 ${statusColors[appt.status] ?? "border-l-gray-200"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="shrink-0 text-center min-w-[52px]">
              <p className="text-xs text-muted-foreground">{dateStr}</p>
              <p className="text-base font-bold">{timeStr}</p>
              <p className="text-xs text-muted-foreground">{appt.durationMinutes} min</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {appt.customer ? (
                  <Link href={`/customers/${appt.customer.id}`}
                    className="font-medium text-sm hover:underline flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {appt.customer.firstName} {appt.customer.lastName}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Bez klijenta
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[appt.type] ?? "bg-gray-100"}`}>
                  {typeLabels[appt.type] ?? appt.type}
                </span>
              </div>
              {appt.notes && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{appt.notes}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isScheduled && (
              <>
                <button onClick={() => onStatusChange(appt.id, "completed")} disabled={isPending}
                  title="Obavljeno"
                  className="p-1.5 rounded hover:bg-green-50 text-green-600 transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => onStatusChange(appt.id, "no_show")} disabled={isPending}
                  title="Nije došao"
                  className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                  <XCircle className="w-4 h-4" />
                </button>
                <button onClick={() => onEdit(appt)}
                  title="Uredi"
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={() => onDelete(appt.id)} disabled={isPending}
              title="Obriši"
              className="p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
