"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompany, inviteUser } from "@/lib/actions/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Plus, X } from "lucide-react";
import type { User, Company } from "@/lib/db/schema";

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-800",
  store_manager: "bg-blue-100 text-blue-800",
  store_employee: "bg-green-100 text-green-800",
  production_employee: "bg-yellow-100 text-yellow-800",
  accountant: "bg-gray-100 text-gray-700",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  store_manager: "Store Manager",
  store_employee: "Store Employee",
  production_employee: "Production Employee",
  accountant: "Accountant",
};

const tabs = ["Korisnici", "Kompanija", "Integracije"];

export function SettingsClient({ users, company }: { users: User[]; company: Company | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("Korisnici");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: "", email: "", role: "store_employee" });
  const [inviteError, setInviteError] = useState("");
  const [companyForm, setCompanyForm] = useState({
    name: company?.name ?? "",
    address: company?.address ?? "",
    taxId: company?.taxId ?? "",
  });
  const [saved, setSaved] = useState(false);

  const handleInvite = () => {
    if (!inviteForm.email || !inviteForm.fullName) return;
    setInviteError("");
    startTransition(async () => {
      try {
        await inviteUser({
          email: inviteForm.email,
          fullName: inviteForm.fullName,
          role: inviteForm.role as "owner" | "store_manager" | "store_employee" | "production_employee" | "accountant",
        });
        setShowInvite(false);
        setInviteForm({ fullName: "", email: "", role: "store_employee" });
        router.refresh();
      } catch (e) {
        setInviteError(e instanceof Error ? e.message : "Greška pri slanju pozivnice");
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === t ? "border-black text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Korisnici */}
      {activeTab === "Korisnici" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{users.length} korisnika u sistemu</p>
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 transition-colors">
              <Plus className="w-4 h-4" /> Pozovi korisnika
            </button>
          </div>

          {/* Invite modal */}
          {showInvite && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Pozovi korisnika</h2>
                  <button onClick={() => setShowInvite(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ime i prezime *</label>
                    <Input value={inviteForm.fullName}
                      onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                      className="mt-1" placeholder="npr. Milena Kovač" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email *</label>
                    <Input type="email" value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="mt-1" placeholder="milena@millimeter.me" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Uloga</label>
                    <select value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                      className="w-full mt-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white">
                      {Object.entries(roleLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {inviteError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{inviteError}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowInvite(false)}
                      className="flex-1 border rounded-md py-2 text-sm hover:bg-muted">Otkaži</button>
                    <button onClick={handleInvite} disabled={isPending || !inviteForm.email || !inviteForm.fullName}
                      className="flex-1 bg-black text-white rounded-md py-2 text-sm hover:bg-black/80 disabled:opacity-50">
                      {isPending ? "Slanje..." : "Pošalji pozivnicu"}
                    </button>
                  </div>
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
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-medium shrink-0">
                            {u.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{u.fullName}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role] ?? "bg-gray-100"}`}>
                          {roleLabels[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                          {u.isActive ? "Aktivan" : "Neaktivan"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("sr-RS")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kompanija */}
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
                <label className="text-xs font-medium text-muted-foreground">PIB / Tax ID</label>
                <Input value={companyForm.taxId}
                  onChange={(e) => setCompanyForm({ ...companyForm, taxId: e.target.value })}
                  className="mt-1" placeholder="npr. 02847361" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Adresa</label>
                <Input value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="mt-1" placeholder="npr. Podgorica, Crna Gora" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Zemlja</label>
                <Input value={company?.country ?? ""} disabled className="mt-1 bg-muted/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valuta</label>
                <Input value={company?.currency ?? "EUR"} disabled className="mt-1 bg-muted/50" />
              </div>
              <button onClick={handleSaveCompany} disabled={isPending}
                className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-md text-sm hover:bg-black/80 disabled:opacity-50 transition-colors">
                {saved ? <><Check className="w-4 h-4" /> Sačuvano!</> : "Sačuvaj promene"}
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Integracije */}
      {activeTab === "Integracije" && (
        <div className="space-y-4 max-w-xl">
          {[
            { name: "gocreate.nu", desc: "Partnerski sajt za naloge", soon: true },
            { name: "Resend (Email)", desc: "Automatska email obaveštenja", soon: false },
            { name: "Twilio (SMS)", desc: "SMS podsetnici za klijente", soon: false },
            { name: "Fiskalna kasa (CG)", desc: "eFiskalizacija Crna Gora", soon: false },
          ].map((i) => (
            <Card key={i.name}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{i.name}</p>
                      {i.soon && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Uskoro</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{i.desc}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Nije povezano</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
