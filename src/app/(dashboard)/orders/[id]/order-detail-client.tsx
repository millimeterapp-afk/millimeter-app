"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus, updateOrderPayment, updateOrder } from "@/lib/actions/orders";
import { createCorrection } from "@/lib/actions/corrections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Printer, Check, CreditCard, AlertCircle, X, Wrench, Pencil } from "lucide-react";
import Link from "next/link";
import type { Order, Customer, CustomerMeasurement, Correction } from "@/lib/db/schema";

type OrderWithDetails = Order & {
  customer: (Customer & { measurements: CustomerMeasurement[] }) | null;
  corrections: Correction[];
};

const statusFlow = [
  { id: "draft" as const, label: "Draft" },
  { id: "confirmed" as const, label: "Potvrđen" },
  { id: "in_production" as const, label: "U produkciji" },
  { id: "ready" as const, label: "Gotov" },
  { id: "delivered" as const, label: "Isporučen" },
];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-800",
  in_production: "bg-yellow-100 text-yellow-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-700",
};

const nextStatusMap: Record<string, string> = {
  draft: "confirmed",
  confirmed: "in_production",
  in_production: "ready",
  ready: "delivered",
};

const nextActionLabels: Record<string, string> = {
  draft: "Potvrdi nalog →",
  confirmed: "Pošalji u produkciju →",
  in_production: "Označi kao gotov ✓",
  ready: "Isporuči klijentu →",
};

export function OrderDetailClient({ order }: { order: OrderWithDetails }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [showCorrection, setShowCorrection] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [materialQty, setMaterialQty] = useState("2");
  const [actionError, setActionError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    item: order.item ?? "",
    totalAmount: String(Number(order.totalAmount)),
    dueDate: order.dueDate ?? "",
    notes: order.notes ?? "",
    collarType: order.collarType ?? "",
    sleeveType: order.sleeveType ?? "",
    fitType: order.fitType ?? "",
    material: order.material ?? "",
  });
  const [corrForm, setCorrForm] = useState({
    correctionType: "Kroj",
    description: "",
    cause: "",
    dueDate: "",
    affectsTemplate: false,
  });

  const customer = order.customer;
  const currentStepIndex = statusFlow.findIndex(s => s.id === order.status);
  const nextStatus = nextStatusMap[order.status];
  const totalAmount = Number(order.totalAmount);
  const paidAmount = Number(order.paidAmount);
  const remaining = totalAmount - paidAmount;

  const handleStatusChange = () => {
    if (!nextStatus) return;
    // Za potvrdu naloga — otvori modal za količinu materijala
    if (order.status === "draft" && order.material) {
      setShowConfirmModal(true);
      return;
    }
    doStatusChange(nextStatus);
  };

  const doStatusChange = (status: string, opts?: { materialQuantity?: number }) => {
    setActionError("");
    startTransition(async () => {
      try {
        await updateOrderStatus(
          order.id,
          status as "draft" | "confirmed" | "in_production" | "ready" | "delivered" | "cancelled",
          opts
        );
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Greška pri promjeni statusa.");
      }
    });
  };

  const handleConfirmWithMaterial = () => {
    setShowConfirmModal(false);
    doStatusChange("confirmed", { materialQuantity: Number(materialQty) || 2 });
  };

  const handleCancel = () => {
    if (!confirm("Da li sigurno želiš da otkaže ovaj nalog?")) return;
    setActionError("");
    startTransition(async () => {
      try {
        await updateOrderStatus(order.id, "cancelled");
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Greška pri otkazivanju naloga.");
      }
    });
  };

  const handlePayment = () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setActionError("");
    startTransition(async () => {
      try {
        await updateOrderPayment(order.id, Math.min(paidAmount + amount, totalAmount), totalAmount);
        setShowPayment(false);
        setPayAmount("");
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Greška pri evidentiranju uplate.");
      }
    });
  };

  const handleSaveEdit = () => {
    setActionError("");
    startTransition(async () => {
      try {
        await updateOrder(order.id, {
          item: editForm.item,
          totalAmount: Number(editForm.totalAmount),
          dueDate: editForm.dueDate,
          notes: editForm.notes,
          collarType: editForm.collarType,
          sleeveType: editForm.sleeveType,
          fitType: editForm.fitType,
          material: editForm.material,
        });
        setShowEdit(false);
        router.refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Greška pri čuvanju izmjena.");
      }
    });
  };

  const handleCreateCorrection = () => {
    if (!corrForm.description) return;
    startTransition(async () => {
      await createCorrection({
        orderId: order.id,
        customerId: order.customerId ?? undefined,
        correctionType: corrForm.correctionType,
        description: corrForm.description,
        cause: corrForm.cause || undefined,
        dueDate: corrForm.dueDate || undefined,
        affectsTemplate: corrForm.affectsTemplate,
      });
      setShowCorrection(false);
      setCorrForm({ correctionType: "Kroj", description: "", cause: "", dueDate: "", affectsTemplate: false });
      router.refresh();
    });
  };

  const handlePrint = () => {
    const measureData = order.measurementSnapshot as Record<string, string> | null;
    const w = window.open("", "_blank");
    if (!w) return;
    const statusLabel = statusFlow.find(s => s.id === order.status)?.label ?? order.status;
    const orderDate = new Date(order.createdAt).toLocaleDateString("sr-RS");
    const printDate = new Date().toLocaleDateString("sr-RS");
    w.document.write(`
      <html><head><title>Nalog ${order.orderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .section { border: 1px solid #eee; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .section h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin: 0 0 12px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .label { color: #666; }
        .value { font-weight: 600; }
        .total { font-size: 20px; font-weight: bold; text-align: right; padding: 16px; background: #f9f9f9; border-radius: 8px; margin-bottom: 16px; }
        .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px; font-size: 12px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head>
      <body>
        <h1>Radni nalog — ${order.item ?? "Nalog"}</h1>
        <div class="sub">${order.orderNumber} &nbsp;·&nbsp; Datum: ${orderDate} &nbsp;·&nbsp; ${statusLabel}</div>
        <div class="grid">
          <div class="section">
            <h2>Klijent</h2>
            ${customer ? `
              <div class="row"><span class="label">Ime</span><span class="value">${customer.firstName} ${customer.lastName}</span></div>
              <div class="row"><span class="label">Telefon</span><span class="value">${customer.phone}</span></div>
            ` : ""}
            <div class="row"><span class="label">Šablon br.</span><span class="value">${order.templateNumber ?? "—"}</span></div>
          </div>
          <div class="section">
            <h2>Detalji naloga</h2>
            <div class="row"><span class="label">Materijal</span><span class="value">${order.material ?? "—"}</span></div>
            <div class="row"><span class="label">Kragla / Rukav / Fit</span><span class="value">${order.collarType ?? "—"} / ${order.sleeveType ?? "—"} / ${order.fitType ?? "—"}</span></div>
            <div class="row"><span class="label">Rok isporuke</span><span class="value">${order.dueDate ?? "—"}</span></div>
          </div>
        </div>
        ${measureData && Object.keys(measureData).length > 0 ? `
        <div class="section">
          <h2>Merenja (cm)</h2>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            ${Object.entries(measureData).map(([k, v]) => `
              <div style="background:#f9f9f9;padding:8px;border-radius:6px">
                <div style="font-size:11px;color:#888;text-transform:capitalize">${k}</div>
                <div style="font-size:15px;font-weight:600">${v && v !== "—" ? v + " cm" : "—"}</div>
              </div>`).join("")}
          </div>
        </div>` : ""}
        ${order.notes ? `<div class="section"><h2>Napomene</h2><p style="font-size:14px">${order.notes}</p></div>` : ""}
        <div class="total">Ukupno: €${totalAmount.toLocaleString()}</div>
        <div class="footer">Millimeter D.O.O. · Podgorica, Crna Gora · Štampano: ${printDate}</div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/orders" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="w-4 h-4" /> Nazad na naloge
      </Link>

      {/* Modal — potvrda naloga s rezervacijom materijala */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Potvrdi nalog</h2>
              <button onClick={() => setShowConfirmModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{order.material}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Materijal za rezervaciju</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Količina za rezervaciju (m)</label>
              <Input
                type="number"
                value={materialQty}
                onChange={(e) => setMaterialQty(e.target.value)}
                className="mt-1"
                min="0"
                step="0.5"
                placeholder="2"
              />
              <p className="text-xs text-muted-foreground mt-1">Koliko metara tkanine treba za ovaj nalog?</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
              <button onClick={handleConfirmWithMaterial} disabled={isPending}
                className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                {isPending ? "..." : "Potvrdi i rezerviši →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal za korekciju */}
      {showCorrection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nova korekcija</h2>
              <button onClick={() => setShowCorrection(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tip korekcije</label>
                <select value={corrForm.correctionType}
                  onChange={(e) => setCorrForm({ ...corrForm, correctionType: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                  {["Kroj", "Dužina", "Širina", "Rukav", "Kragla", "Šav", "Ostalo"].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Opis korekcije *</label>
                <textarea value={corrForm.description}
                  onChange={(e) => setCorrForm({ ...corrForm, description: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-20"
                  placeholder="Šta treba ispraviti..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Uzrok</label>
                <Input value={corrForm.cause}
                  onChange={(e) => setCorrForm({ ...corrForm, cause: e.target.value })}
                  className="mt-1" placeholder="npr. Pogrešna mera pri kreiranju" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rok</label>
                <Input type="date" value={corrForm.dueDate}
                  onChange={(e) => setCorrForm({ ...corrForm, dueDate: e.target.value })}
                  className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={corrForm.affectsTemplate}
                  onChange={(e) => setCorrForm({ ...corrForm, affectsTemplate: e.target.checked })}
                  className="rounded" />
                Utiče na šablon klijenta
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowCorrection(false)}
                className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
              <button onClick={handleCreateCorrection}
                disabled={isPending || !corrForm.description}
                className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                {isPending ? "Čuvanje..." : "Sačuvaj korekciju"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal za edit naloga */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Uredi nalog</h2>
              <button onClick={() => setShowEdit(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Naziv artikla</label>
                <Input value={editForm.item} onChange={e => setEditForm({ ...editForm, item: e.target.value })} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cena (€)</label>
                  <Input type="number" value={editForm.totalAmount} onChange={e => setEditForm({ ...editForm, totalAmount: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Rok isporuke</label>
                  <Input type="date" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Materijal</label>
                <Input value={editForm.material} onChange={e => setEditForm({ ...editForm, material: e.target.value })} className="mt-1" placeholder="npr. Bijela flanela" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Kragla", key: "collarType" as const, options: ["Klasična", "Talijanska", "Button-down", "Mao", "Windsor"] },
                  { label: "Rukav", key: "sleeveType" as const, options: ["Duga", "Kratka", "Dupla manžetna"] },
                  { label: "Fit", key: "fitType" as const, options: ["Slim fit", "Regular fit", "Comfort fit"] },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                    <select value={editForm[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                      className="w-full mt-1 border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                      {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Napomene</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-20" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowEdit(false)} className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
              <button onClick={handleSaveEdit} disabled={isPending}
                className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                {isPending ? "Čuvanje..." : "Sačuvaj izmjene"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{order.item ?? "Nalog"}</h1>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColors[order.status] ?? "bg-gray-100"}`}>
              {statusFlow.find(s => s.id === order.status)?.label ?? order.status}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1 font-mono">{order.orderNumber}</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {order.status !== "delivered" && order.status !== "cancelled" && (
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 border px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
              <Pencil className="w-4 h-4" /> Uredi
            </button>
          )}
          <button onClick={() => setShowCorrection(true)}
            className="flex items-center gap-2 border px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <Wrench className="w-4 h-4" /> Korekcija
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 border px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
            <Printer className="w-4 h-4" /> Štampaj
          </button>
          {order.status !== "delivered" && order.status !== "cancelled" && (
            <button onClick={handleCancel} disabled={isPending}
              className="flex items-center gap-2 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
              Otkaži
            </button>
          )}
          {nextStatus && nextActionLabels[order.status] && (
            <button onClick={handleStatusChange} disabled={isPending}
              className="bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors disabled:opacity-50">
              {isPending ? "..." : nextActionLabels[order.status]}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Status timeline */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center">
            {statusFlow.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors
                    ${i <= currentStepIndex ? "bg-black text-white" : "bg-muted text-muted-foreground"}`}>
                    {i < currentStepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 whitespace-nowrap ${i === currentStepIndex ? "font-semibold" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < statusFlow.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mb-4 ${i < currentStepIndex ? "bg-black" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {/* Order details */}
        <Card className="col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalji naloga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Tip", value: order.orderType === "custom" ? "Po meri" : order.orderType === "ready_made" ? "Gotova roba" : "Korekcija" },
                { label: "Materijal", value: order.material ?? "—" },
                { label: "Datum naloga", value: new Date(order.createdAt).toLocaleDateString("sr-RS") },
                { label: "Rok isporuke", value: order.dueDate ?? "—", orange: !!order.dueDate },
                { label: "Šablon broj", value: order.templateNumber ?? "—", mono: true },
                { label: "Cena", value: `€${totalAmount.toLocaleString()}`, bold: true },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className={`text-sm mt-0.5 ${f.bold ? "font-bold text-base" : "font-medium"} ${f.orange ? "text-orange-600" : ""} ${f.mono ? "font-mono" : ""}`}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>

            {(order.collarType || order.sleeveType || order.fitType) && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Specifikacija</p>
                <div className="flex gap-2 flex-wrap">
                  {order.collarType && <span className="text-xs bg-muted px-2 py-1 rounded">Kragla: {order.collarType}</span>}
                  {order.sleeveType && <span className="text-xs bg-muted px-2 py-1 rounded">Rukav: {order.sleeveType}</span>}
                  {order.fitType && <span className="text-xs bg-muted px-2 py-1 rounded">Fit: {order.fitType}</span>}
                </div>
              </div>
            )}

            {order.notes && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1">Napomene</p>
                <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4" /> Klijent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer ? (
              <>
                <Link href={`/customers/${customer.id}`} className="font-medium hover:underline block">
                  {customer.firstName} {customer.lastName}
                </Link>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
                {customer.city && <p className="text-sm text-muted-foreground">{customer.city}</p>}
                {customer.templateNumber && (
                  <p className="text-xs text-muted-foreground font-mono">Šablon: {customer.templateNumber}</p>
                )}
                {customer.measurements.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Merenja</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(customer.measurements[0].data as Record<string, string>).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="text-muted-foreground capitalize">{k}: </span>
                          <span className="font-medium">{v && v !== "—" ? `${v} cm` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Klijent nije pronađen</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment */}
      {order.status !== "cancelled" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Naplata
            </CardTitle>
            {remaining > 0 && (
              <button onClick={() => setShowPayment(!showPayment)}
                className="text-xs bg-black text-white px-3 py-1.5 rounded hover:bg-black/80">
                + Uplata
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Ukupno</p>
                <p className="text-xl font-bold">€{totalAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plaćeno</p>
                <p className="text-xl font-bold text-green-600">€{paidAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ostatak</p>
                <p className={`text-xl font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  €{remaining.toLocaleString()}
                </p>
              </div>
              <div className="ml-auto">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  order.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
                  order.paymentStatus === "partial" ? "bg-yellow-100 text-yellow-800" :
                  "bg-red-100 text-red-700"
                }`}>
                  {order.paymentStatus === "paid" ? "Plaćeno" : order.paymentStatus === "partial" ? "Djelimično plaćeno" : "Neplaćeno"}
                </span>
              </div>
            </div>

            {showPayment && (
              <div className="mt-4 pt-4 border-t flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Iznos (€)</label>
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    className="mt-1 w-36" placeholder={String(remaining)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Način plaćanja</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                    className="mt-1 block border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                    <option value="cash">Gotovina</option>
                    <option value="card">Kartica</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <button onClick={handlePayment} disabled={isPending || !payAmount}
                  className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 disabled:opacity-50">
                  <Check className="w-4 h-4" /> Potvrdi uplatu
                </button>
                <button onClick={() => setShowPayment(false)}
                  className="text-sm text-muted-foreground hover:text-foreground px-2 py-2">
                  Otkaži
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Corrections */}
      {order.corrections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Korekcije ({order.corrections.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.corrections.map(c => (
              <div key={c.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex-1">
                  <p className="font-medium">{c.description}</p>
                  {c.cause && <p className="text-xs text-muted-foreground mt-0.5">{c.cause}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  c.status === "resolved" ? "bg-green-100 text-green-800" :
                  c.status === "in_production" ? "bg-yellow-100 text-yellow-800" :
                  c.status === "not_resolved" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {c.status === "resolved" ? "Rešeno" :
                   c.status === "in_production" ? "U produkciji" :
                   c.status === "not_resolved" ? "Nije rešeno" : "Otvoreno"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
