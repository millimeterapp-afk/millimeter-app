"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CustomerPicker } from "@/components/customer-picker";
import { MaterialPicker } from "@/components/material-picker";
import { createKosuljaNalog } from "@/lib/actions/kosulja-nalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shirt, AlertTriangle, Check } from "lucide-react";
import {
  KRAGNE, STEJ_OPCIJE, SPIC_OPCIJE, MANZETNE, KROJEVI,
  MERE_LIMITI, KOMBINOVANO_LIMIT, deltaVanLimita, baznaMera,
} from "@/lib/kosulja";

const aktivniKrojevi = KROJEVI.filter((k) => k.aktivan);

export function NalogKosuljaClient() {
  const [customer, setCustomer] = useState<{ id: string; label: string } | null>(null);
  const [krojId, setKrojId] = useState(aktivniKrojevi[0]?.id ?? "");
  const [velicina, setVelicina] = useState("");
  const [materijal, setMaterijal] = useState("");
  const [kragna, setKragna] = useState("");
  const [stej, setStej] = useState<string>(STEJ_OPCIJE[0]);
  const [spic, setSpic] = useState<string>(SPIC_OPCIJE[0]);
  const [manzetna, setManzetna] = useState("");
  const [delte, setDelte] = useState<Record<string, string>>({});
  const [napomena, setNapomena] = useState("");
  const [cena, setCena] = useState("");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  const kroj = aktivniKrojevi.find((k) => k.id === krojId);
  const baza = krojId === "hol_slim" && velicina ? baznaMera(velicina) : null;
  const num = (k: string) => Number(delte[k] || 0);
  const kombinovanoVanLimita =
    Math.abs(num("orukavlje")) + Math.abs(num("biceps")) > KOMBINOVANO_LIMIT.limit;
  const imaPrekoracenje =
    MERE_LIMITI.some((m) => deltaVanLimita(m.key, num(m.key))) || kombinovanoVanLimita;

  const validno = !!customer && !!velicina && !!kragna && !!manzetna && !imaPrekoracenje;

  const setDelta = (k: string, v: string) => setDelte((p) => ({ ...p, [k]: v }));

  const kreiraj = () => {
    if (!validno) return;
    setError("");
    const korekcije: Record<string, number> = {};
    MERE_LIMITI.forEach((m) => { const d = num(m.key); if (d !== 0) korekcije[m.key] = d; });
    startTransition(async () => {
      try {
        await createKosuljaNalog({
          customerId: customer!.id,
          kroj: kroj?.naziv ?? "",
          velicina, kragna, stej, spic, manzetna,
          materijal: materijal || undefined,
          cena: Number(cena) || 0,
          korekcije,
          bazneMere: baza,
          napomena: napomena || undefined,
          idempotencyKey: idemKey,
        });
        setSuccess(true);
        setCustomer(null); setVelicina(""); setMaterijal(""); setKragna("");
        setStej(STEJ_OPCIJE[0]); setSpic(SPIC_OPCIJE[0]); setManzetna("");
        setDelte({}); setNapomena(""); setCena("");
        setIdemKey(crypto.randomUUID());
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Greška pri kreiranju naloga.");
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shirt className="w-6 h-6" /> Nalog za košulju</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Domaća proizvodnja. Verzija 1 — opcije i korekcije mera. Bazne mere po veličini i čuvanje u bazu dodajemo uz Munro tabelu.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Klijent</CardTitle></CardHeader>
        <CardContent>
          <CustomerPicker value={customer} onChange={setCustomer} placeholder="Pretraži klijenta po imenu ili broju..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Košulja</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Kroj *</label>
              <select value={krojId} onChange={(e) => { setKrojId(e.target.value); setVelicina(""); }}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
                {aktivniKrojevi.map((k) => <option key={k.id} value={k.id}>{k.naziv}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Olimp / Naš slim / Hol reg — dodajemo kasnije.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Veličina *</label>
              <select value={velicina} onChange={(e) => setVelicina(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
                <option value="">—</option>
                {kroj?.velicine.map((v) => <option key={v} value={v}>{kroj.naziv} {v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Materijal</label>
            <MaterialPicker value={materijal} onChange={setMaterijal} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground">Kragna *</label>
              <select value={kragna} onChange={(e) => setKragna(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
                <option value="">—</option>
                {KRAGNE.map((k) => <option key={k.sr} value={k.sr}>{k.sr} ({k.en})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Visina šteja</label>
              <select value={stej} onChange={(e) => setStej(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
                {STEJ_OPCIJE.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Špic</label>
              <select value={spic} onChange={(e) => setSpic(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
                {SPIC_OPCIJE.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Privremeno — detalji po kragni stižu.</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Manžetna *</label>
            <select value={manzetna} onChange={(e) => setManzetna(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10">
              <option value="">—</option>
              {MANZETNE.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Cena (RSD)</label>
            <input type="number" value={cena} onChange={(e) => setCena(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-10 focus:outline-none focus:ring-2 focus:ring-black" placeholder="0" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-base">Mere i korekcije</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Uneseš korekcije na baznu veličinu (npr. +2 grudi, −2 biceps). Korekcija preko ograničenja se blokira.
          </p>

          {baza && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-2">Bazne mere — Hol slim {velicina} (Munro tabela)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                {baza.map((m) => (
                  <div key={m.letter} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{m.sr}{m.half ? " (obim)" : ""}</span>
                    <span className="font-medium">{m.obim} cm</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Konačne mere (bazne + korekcije) uključujemo čim Aleksandar potvrdi mapiranje naziva i način unosa
                korekcije (±cm na obim ili na ½).
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {MERE_LIMITI.map((m) => {
              const d = num(m.key);
              const van = deltaVanLimita(m.key, d);
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">{m.label}</label>
                    <span className="text-[11px] text-muted-foreground">{m.limit === null ? "bez limita" : `± ${m.limit}`}</span>
                  </div>
                  <input type="number" value={delte[m.key] ?? ""} onChange={(e) => setDelta(m.key, e.target.value)}
                    placeholder="0"
                    className={`mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white h-9 ${van ? "border-red-400 focus:ring-red-400" : "focus:ring-black"} focus:outline-none focus:ring-2`} />
                  {van && <p className="text-[11px] text-red-600 mt-0.5">Prekoračeno (max ± {m.limit}) — daj veći bazni broj.</p>}
                </div>
              );
            })}
          </div>
          {kombinovanoVanLimita && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Orukavlje + biceps zajedno prekoračuju ± {KOMBINOVANO_LIMIT.limit}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Napomena</CardTitle></CardHeader>
        <CardContent>
          <textarea value={napomena} onChange={(e) => setNapomena(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none h-16"
            placeholder="Napomena za proizvodnju..." />
        </CardContent>
      </Card>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-2 rounded-md flex items-center gap-2">
          <Check className="w-4 h-4" /> Nalog za košulju je kreiran.
        </div>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <button onClick={kreiraj} disabled={!validno || isPending}
        className="w-full bg-black text-white rounded-md py-2.5 text-sm font-medium hover:bg-black/80 disabled:opacity-50 flex items-center justify-center gap-2">
        <Shirt className="w-4 h-4" /> {isPending ? "Čuvanje..." : "Kreiraj nalog"}
      </button>
    </div>
  );
}
