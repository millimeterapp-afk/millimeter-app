"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompany, createUserWithPassword, updateUserRole, toggleUserActive } from "@/lib/actions/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Plus, X, ShieldCheck, UserX, UserCheck } from "lucide-react";
import type { User, Company } from "@/lib/db/schema";

const ROLE_LABELS: Record<string, string> = {
  owner: "Vlasnik",
  store_manager: "Menadžer radnje",
  store_employee: "Radnik radnje",
  production_employee: "Produkcija / Krojač",
  accountant: "Računovodja",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  store_manager: "bg-blue-100 text-blue-800",
  store_employee: "bg-green-100 text-green-800",
  production_employee: "bg-yellow-100 text-yellow-800",
  accountant: "bg-gray-100 text-gray-700",
};

const ROLE_DESC: Record<string, string> = {
  owner: "Pun pristup — nalozi, klijenti, izveštaji, podešavanja",
  store_manager: "Nalozi, klijenti, izveštaji — bez podešavanja",
  store_employee: "Nalozi i klijenti — bez izveštaja",
  production_employee: "Samo produkcijski board i nalozi",
  accountant: "Samo izveštaji i finansije",
};

const tabs = ["Korisnici", "Kompanija", "Integracije"];

type Role = "owner" | "store_manager" | "store_employee" | "production_employee" | "accountant";

export function SettingsClient({
  users,
  company,
  currentUserId,
  currentUserRole,
}: {
  users: User[];
  company: Company | null;
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("Korisnici");
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", email: "", role: "store_employee", password: "" });
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: company?.name ?? "",
    address: company?.address ?? "",
    taxId: company?.taxId ?? "",
  });
  const [saved, setSaved] = useState(false);

  const isOwner = currentUserRole === "owner";

  const handleAdd = () => {
    if (!addForm.email || !addForm.fullName || !addForm.password) return;
    setAddError("");
    setAddSuccess("");
    startTransition(async () => {
      try {
        await createUserWithPassword({
          email: addForm.email,
          fullName: addForm.fullName,
          role: addForm.role as Role,
          password: addForm.password,
        });
        setAddSuccess(`Nalog za ${addForm.fullName} je kreiran. Lozinka: ${addForm.password}`);
        setAddForm({ fullName: "", email: "", role: "store_employee", password: "" });
        router.refresh();
      } catch (e) {
        setAddError(e instanceof Error ? e.message : "Greška pri kreiranju korisnika");
      }
    });
  };

  const handleRoleChange = (userId: string, role: Role) => {
    startTransition(async () => {
      try {
        await updateUserRole(userId, role);
        setEditingRole(null);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Greška");
      }
    });
  };

  const handleToggleActive = (userId: string, name: string, isActive: boolean) => {
    const action = isActive ? "deaktivirate" : "reaktivirate";
    if (!confirm(`Da li sigurno želite da ${action} nalog za ${name}?`)) return;
    startTransition(async () => {
      try {
        await toggleUserActive(userId);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Greška");
      }
    });
  };

  const handleSaveCompany = () => {
    startTransition(async () => {
      await updateCompany(companyForm);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Podešavanja</h1>
        <p className="text-muted-foreground text-sm mt-1">Upravljanje sistemom</p>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === t ? "border-black text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Korisnici ── */}
      {activeTab === "Korisnici" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.length} korisnika u sistemu</p>
            {isOwner && (
              <button onClick={() => { setShowAdd(true); setAddError(""); setAddSuccess(""); }}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
                <Plus className="w-4 h-4" /> Dodaj korisnika
              </button>
            )}
          </div>

          {/* Modal — dodaj korisnika */}
          {showAdd && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Dodaj korisnika</h2>
                  <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ime i prezime *</label>
                    <Input value={addForm.fullName}
                      onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                      className="mt-1" placeholder="npr. Milena Kovač" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email *</label>
                    <Input type="email" value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      className="mt-1" placeholder="milena@millimeter.rs" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Privremena lozinka *</label>
                    <Input value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      className="mt-1" placeholder="npr. Millimeter2026!" />
                    <p className="text-xs text-muted-foreground mt-1">Korisnik može promeniti lozinku nakon prve prijave</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Uloga</label>
                    <select value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">{ROLE_DESC[addForm.role]}</p>
                  </div>

                  {addError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{addError}</p>
                  )}
                  {addSuccess && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-3">
                      <p className="font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Korisnik kreiran!</p>
                      <p className="mt-1">{addSuccess}</p>
                    </div>
                  )}

                  {!addSuccess && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setShowAdd(false)}
                        className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                      <button onClick={handleAdd}
                        disabled={isPending || !addForm.email || !addForm.fullName || !addForm.password}
                        className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                        {isPending ? "Kreiranje..." : "Kreiraj nalog"}
                      </button>
                    </div>
                  )}
                  {addSuccess && (
                    <button onClick={() => setShowAdd(false)}
                      className="w-full border rounded-md py-2 text-sm hover:bg-muted">Zatvori</button>
                  )}
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Korisnik</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Uloga</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Dodat</th>
                    {isOwner && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={`border-b last:border-0 transition-colors ${u.isActive ? "hover:bg-muted/20" : "opacity-50"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0
                            ${u.id === currentUserId ? "bg-black text-white" : "bg-muted text-foreground"}`}>
                            {u.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {u.fullName}
                              {u.id === currentUserId && <span className="text-xs text-muted-foreground ml-1">(ti)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOwner && editingRole === u.id ? (
                          <select
                            defaultValue={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                            disabled={isPending}
                            autoFocus
                            onBlur={() => setEditingRole(null)}
                            className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black bg-white"
                          >
                            {Object.entries(ROLE_LABELS).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => isOwner && u.id !== currentUserId && setEditingRole(u.id)}
                            title={isOwner && u.id !== currentUserId ? "Klikni za promjenu uloge" : undefined}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100"}
                              ${isOwner && u.id !== currentUserId ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                          >
                            {ROLE_LABELS[u.role] ?? u.role}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit
                          ${u.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                          {u.isActive ? <><UserCheck className="w-3 h-3" /> Aktivan</> : <><UserX className="w-3 h-3" /> Neaktivan</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("sr-RS")}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3">
                          {u.id !== currentUserId && (
                            <button
                              onClick={() => handleToggleActive(u.id, u.fullName, u.isActive)}
                              disabled={isPending}
                              title={u.isActive ? "Deaktiviraj korisnika" : "Reaktiviraj korisnika"}
                              className="text-xs text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-green-600" />}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {isOwner && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Uloge i pristup</p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(ROLE_DESC).map(([role, desc]) => (
                    <p key={role}><span className="font-medium">{ROLE_LABELS[role]}:</span> {desc}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Kompanija ── */}
      {activeTab === "Kompanija" && (
        <div className="space-y-4 max-w-xl">
          <Card>
            <CardHeader><CardTitle className="text-base">Podaci o kompaniji</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Naziv firme</label>
                <Input value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">PIB</label>
                <Input value={companyForm.taxId}
                  onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
                  className="mt-1" placeholder="npr. 12345678" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Adresa</label>
                <Input value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="mt-1" placeholder="npr. Omladinskih brigada 86g, Beograd" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Zemlja</label>
                <Input value={company?.country ?? ""} disabled className="mt-1 bg-muted/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valuta</label>
                <Input value={company?.currency ?? "RSD"} disabled className="mt-1 bg-muted/50" />
              </div>
              <button onClick={handleSaveCompany} disabled={isPending}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 disabled:opacity-50 transition-colors">
                {saved ? <><Check className="w-4 h-4" /> Sačuvano!</> : "Sačuvaj promene"}
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Integracije ── */}
      {activeTab === "Integracije" && (
        <div className="space-y-4 max-w-xl">
          {[
            { name: "GoCreate (Munro)", desc: "Automatski sync klijenata i praćenje Munro naloga", connected: true },
            { name: "Resend (Email)", desc: "Automatska email obaveštenja klijentima", connected: false },
            { name: "Twilio (SMS)", desc: "SMS podsetnici za klijente", connected: false },
          ].map((i) => (
            <Card key={i.name}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{i.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{i.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${i.connected ? "bg-green-100 text-green-700" : "text-muted-foreground"}`}>
                    {i.connected ? "Povezano" : "Nije povezano"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
