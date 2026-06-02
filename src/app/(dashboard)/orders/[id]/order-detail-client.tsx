"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus, updateOrderPayment, updateOrder } from "@/lib/actions/orders";
import { createCorrection } from "@/lib/actions/corrections";
import { syncCustomerToGoCreate } from "@/lib/actions/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, User, Printer, Check, CreditCard, AlertCircle, X, Wrench, Pencil, ExternalLink, RefreshCw } from "lucide-react";
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
  const [gcSyncDone, setGcSyncDone] = useState(false);
  const [gcSyncError, setGcSyncError] = useState("");
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

    const orderDate = new Date(order.createdAt).toLocaleDateString("sr-RS");
    const printDate = new Date().toLocaleDateString("sr-RS");
    const isMunro = order.productionFlow === "munro";

    const MEASURE_LABELS: Record<string, string> = {
      vrat: "Vrat", grudi: "Grudi", struk: "Struk", stomak: "Stomak",
      kukovi: "Kukovi", duzina_napred: "Dužina napred", duzina_nazad: "Dužina nazad",
      aksla: "Aksla", ledja: "Leđa", rukav: "Rukav",
      biceps: "Biceps", podlaktica: "Podlaktica", zglob: "Zglob",
    };
    const MEASURE_ORDER = ["vrat","grudi","struk","stomak","kukovi","duzina_napred","duzina_nazad","aksla","ledja","rukav","biceps","podlaktica","zglob"];

    const measures = measureData
      ? MEASURE_ORDER
          .filter(k => measureData[k] && measureData[k] !== "—")
          .map(k => ({ label: MEASURE_LABELS[k] ?? k, value: measureData[k] }))
      : [];

    const hasMonogram = measureData?.monogram_pozicija;
    const specs = [
      order.collarType ? `Kragla: <strong>${order.collarType}</strong>` : null,
      order.sleeveType ? `Manžetna: <strong>${order.sleeveType}</strong>` : null,
      order.fitType    ? `Fit: <strong>${order.fitType}</strong>`         : null,
    ].filter(Boolean).join(" &nbsp;·&nbsp; ");

    w.document.write(`<!DOCTYPE html>
<html lang="sr"><head>
<meta charset="UTF-8">
<title>Nalog ${order.orderNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 28px 32px; max-width: 780px; margin: auto; }
  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #111; }
  .brand { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
  .brand span { font-weight: 300; }
  .brand-sub { font-size: 10px; color: #888; letter-spacing: 0.05em; margin-top: 2px; }
  .order-meta { text-align: right; }
  .order-num { font-size: 18px; font-weight: 700; font-family: monospace; }
  .order-date { font-size: 11px; color: #666; margin-top: 3px; }
  .flow-badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-top: 5px; background: ${isMunro ? "#ede9fe" : "#f0fdf4"}; color: ${isMunro ? "#7c3aed" : "#15803d"}; border: 1px solid ${isMunro ? "#c4b5fd" : "#86efac"}; }
  /* ── Title bar ── */
  .title-bar { background: #111; color: #fff; padding: 10px 16px; border-radius: 6px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .title-bar h1 { font-size: 17px; font-weight: 700; }
  .title-bar .due { font-size: 12px; color: #ccc; }
  .title-bar .due strong { color: #fbbf24; font-size: 14px; }
  /* ── Two-col info ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; }
  .card-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; font-weight: 700; margin-bottom: 8px; }
  .card-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f3f3; font-size: 12.5px; }
  .card-row:last-child { border-bottom: none; }
  .card-row .lbl { color: #666; }
  .card-row .val { font-weight: 600; text-align: right; max-width: 55%; }
  /* ── Specs strip ── */
  .specs { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 9px 14px; font-size: 12.5px; color: #444; margin-bottom: 14px; }
  /* ── Measurements ── */
  .meas-section { border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; }
  .meas-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; font-weight: 700; margin-bottom: 10px; }
  .meas-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
  .meas-cell { text-align: center; border: 1px solid #e9e9e9; border-radius: 5px; padding: 7px 4px; background: #fafafa; }
  .meas-cell .ml { font-size: 9.5px; color: #888; margin-bottom: 3px; }
  .meas-cell .mv { font-size: 16px; font-weight: 700; color: #111; line-height: 1; }
  .meas-cell .mu { font-size: 9px; color: #aaa; }
  /* ── Monogram ── */
  .mono-section { border: 1px solid #ddd6fe; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; background: #faf5ff; }
  .mono-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #7c3aed; font-weight: 700; margin-bottom: 6px; }
  .mono-row { display: flex; gap: 24px; font-size: 12.5px; }
  .mono-row span { color: #888; margin-right: 4px; }
  /* ── Notes ── */
  .notes { border: 1px solid #fed7aa; background: #fff7ed; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
  .notes-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #c2410c; font-weight: 700; margin-bottom: 5px; }
  .notes p { font-size: 12.5px; color: #431407; line-height: 1.5; }
  /* ── Sign strip ── */
  .sign-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
  .sign-box .sign-label { font-size: 9.5px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 28px; }
  .sign-box .sign-line { border-bottom: 1px solid #ccc; }
  /* ── Footer ── */
  .footer { margin-top: 14px; font-size: 10px; color: #bbb; text-align: center; }
  @media print {
    body { padding: 16px 20px; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head><body>

<div class="header">
  <div>
    <div class="brand">MILLI<span>METER</span></div>
    <div class="brand-sub">PREMIUM KROJAČNICA · BEOGRAD</div>
  </div>
  <div class="order-meta">
    <div class="order-num">${order.orderNumber}</div>
    <div class="order-date">Datum naloga: ${orderDate}</div>
    <div><span class="flow-badge">${isMunro ? "MUNRO" : "MILLIMETER"} PRODUKCIJA</span></div>
  </div>
</div>

<div class="title-bar">
  <h1>${order.item ?? "Nalog"}</h1>
  <div class="due">Rok isporuke: <strong>${order.dueDate ?? "nije određen"}</strong></div>
</div>

<div class="info-grid">
  <div class="card">
    <div class="card-title">Klijent</div>
    ${customer ? `
      <div class="card-row"><span class="lbl">Ime i prezime</span><span class="val">${customer.firstName} ${customer.lastName}</span></div>
      <div class="card-row"><span class="lbl">Telefon</span><span class="val">${customer.phone}</span></div>
      ${customer.templateNumber ? `<div class="card-row"><span class="lbl">Šablon br.</span><span class="val" style="font-family:monospace;font-size:14px;font-weight:800">${customer.templateNumber}</span></div>` : ""}
    ` : `<div class="card-row"><span class="lbl">—</span></div>`}
    ${order.templateNumber && order.templateNumber !== customer?.templateNumber ? `<div class="card-row"><span class="lbl">Šablon (nalog)</span><span class="val" style="font-family:monospace">${order.templateNumber}</span></div>` : ""}
  </div>
  <div class="card">
    <div class="card-title">Specifikacija</div>
    ${order.material ? `<div class="card-row"><span class="lbl">Materijal</span><span class="val">${order.material}</span></div>` : ""}
    ${order.collarType ? `<div class="card-row"><span class="lbl">Kragla</span><span class="val">${order.collarType}</span></div>` : ""}
    ${order.sleeveType ? `<div class="card-row"><span class="lbl">Manžetna</span><span class="val">${order.sleeveType}</span></div>` : ""}
    ${order.fitType ? `<div class="card-row"><span class="lbl">Fit</span><span class="val">${order.fitType}</span></div>` : ""}
  </div>
</div>

${measures.length > 0 ? `
<div class="meas-section">
  <div class="meas-title">Mere (cm)</div>
  <div class="meas-grid">
    ${measures.map(m => `
      <div class="meas-cell">
        <div class="ml">${m.label}</div>
        <div class="mv">${m.value}</div>
        <div class="mu">cm</div>
      </div>`).join("")}
  </div>
</div>` : ""}

${hasMonogram ? `
<div class="mono-section">
  <div class="mono-title">Monogram / Inicijali</div>
  <div class="mono-row">
    <div><span>Pozicija:</span><strong>${measureData?.monogram_pozicija ?? "—"}</strong></div>
    <div><span>Boja:</span><strong>${measureData?.monogram_boja || "—"}</strong></div>
    <div><span>Font:</span><strong>${measureData?.monogram_font ?? "—"}</strong></div>
  </div>
</div>` : ""}

${order.notes ? `
<div class="notes">
  <div class="notes-title">Napomene za krojača</div>
  <p>${order.notes}</p>
</div>` : ""}

<div class="sign-strip">
  <div class="sign-box">
    <div class="sign-label">Preuzeo u produkciju</div>
    <div class="sign-line"></div>
  </div>
  <div class="sign-box">
    <div class="sign-label">Datum predaje</div>
    <div class="sign-line"></div>
  </div>
  <div class="sign-box">
    <div class="sign-label">Predao u radnju</div>
    <div class="sign-line"></div>
  </div>
</div>

<div class="footer">Millimeter D.O.O. · Beograd, Srbija &nbsp;·&nbsp; Štampano: ${printDate} &nbsp;·&nbsp; NALOG ZA KROJAČA</div>

<script>window.onload = () => { window.print(); }<\/script>
</body></html>`);
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
                  <label className="text-xs font-medium text-muted-foreground">Cena (RSD )</label>
                  <Input type="number" value={editForm.totalAmount} onChange={e => setEditForm({ ...editForm, totalAmount: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Rok isporuke</label>
                  <Input type="date" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Materijal</label>
                <Input value={editForm.material} onChange={e => setEditForm({ ...editForm, material: e.target.value })} className="mt-1" placeholder="npr. Bela flanela" />
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
                { label: "Cena", value: `RSD ${totalAmount.toLocaleString()}`, bold: true },
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

      {/* GoCreate panel — samo za Munro naloge */}
      {order.productionFlow === "munro" && (
        <Card className="border-purple-200 bg-purple-50/40">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-purple-700 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Munro / GoCreate
            </CardTitle>
            {customer?.goCreateCustomerId && (
              <a
                href={`https://gocreate.nu/Customer/Detail/${customer.goCreateCustomerId}?redirectToFitProfileTab=True`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 font-medium border border-purple-300 bg-white px-3 py-1.5 rounded-md hover:bg-purple-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Otvori u GoCreate
              </a>
            )}
          </CardHeader>
          <CardContent>
            {customer?.goCreateCustomerId ? (
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-xs text-muted-foreground">GoCreate ID klijenta</p>
                  <p className="text-sm font-mono font-medium">{customer.goCreateCustomerId}</p>
                </div>
                {customer.goCreateSyncedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Sinhronizovano</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(customer.goCreateSyncedAt).toLocaleDateString("sr-RS")}
                    </p>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    Sinhronizovano
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">Klijent nije sinhronizovan sa GoCreate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Klikni dugme da dodaš klijenta u GoCreate i povežeš nalog
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {gcSyncError && (
                    <p className="text-xs text-red-600">{gcSyncError}</p>
                  )}
                  {gcSyncDone ? (
                    <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Sync pokrenuto
                    </span>
                  ) : (
                    <button
                      disabled={isPending || !customer}
                      onClick={() => {
                        if (!customer) return;
                        setGcSyncError("");
                        startTransition(async () => {
                          const result = await syncCustomerToGoCreate(customer.id);
                          if (result.ok) {
                            setGcSyncDone(true);
                            router.refresh();
                          } else {
                            setGcSyncError(result.error);
                          }
                        });
                      }}
                      className="flex items-center gap-1.5 text-xs border border-purple-300 bg-white text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-50 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {isPending ? "Sinhronizacija..." : "Sync u GoCreate"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <p className="text-xl font-bold">RSD {totalAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plaćeno</p>
                <p className="text-xl font-bold text-green-600">RSD {paidAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ostatak</p>
                <p className={`text-xl font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                  RSD {remaining.toLocaleString()}
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
                  <label className="text-xs text-muted-foreground font-medium">Iznos (RSD )</label>
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
