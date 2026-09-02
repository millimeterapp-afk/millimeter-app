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
  konacneMere, OSTALE_MERE_SLOVA,
  MONOGRAM_MESTO, MONOGRAM_BOJA, MONOGRAM_FONT,
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
  const [inicijali, setInicijali] = useState(false);
  const [monogramTekst, setMonogramTekst] = useState("");
  const [monogramMesto, setMonogramMesto] = useState<string>(MONOGRAM_MESTO[0]);
  const [monogramBoja, setMonogramBoja] = useState<string>(MONOGRAM_BOJA[0]);
  const [monogramFont, setMonogramFont] = useState<string>(MONOGRAM_FONT[0]);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  const kroj = aktivniKrojevi.find((k) => k.id === krojId);
  const baza = krojId === "hol_slim" && velicina ? baznaMera(velicina) : null;
  const num = (k: string) => Number(delte[k] || 0);
  const korekcijeMap = Object.fromEntries(MERE_LIMITI.map((m) => [m.key, num(m.key)]));
  const mere = baza ? konacneMere(velicina, korekcijeMap) : null;
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
          mereSaStrane: mere ?? undefined,
          monogram: inicijali
            ? { tekst: monogramTekst, mesto: monogramMesto, boja: monogramBoja, font: monogramFont }
            : undefined,
          napomena: napomena || undefined,
          idempotencyKey: idemKey,
        });
        setSuccess(true);
        setCustomer(null); setVelicina(""); setMaterijal(""); setKragna("");
        setStej(STEJ_OPCIJE[0]); setSpic(SPIC_OPCIJE[0]); setManzetna("");
        setDelte({}); setNapomena(""); setCena("");
        setInicijali(false); setMonogramTekst(""); setMonogramMesto(MONOGRAM_MESTO[0]);
        setMonogramBoja(MONOGRAM_BOJA[0]); setMonogramFont(MONOGRAM_FONT[0]);
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
          Domaća proizvodnja — kroj, kragna, manžetna, inicijali i mere sa automatskim ograničenjima.
        </p>
      </div>

      {/* overflow-visible — Card po default-u seče sadržaj (overflow-hidden), pa je padajuća
          lista rezultata izlazila iseceno/skriveno iza sledeće kartice (Aleksandrov nalaz) */}
      <Card className="overflow-visible">
        <CardHeader className="pb-3"><CardTitle className="text-base">Klijent</CardTitle></CardHeader>
        <CardContent className="overflow-visible">
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
            <MaterialPicker value={materijal} onChange={(name, salePrice) => {
              setMaterijal(name);
              if (salePrice != null) setCena(String(Math.round(salePrice)));
            }} />
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={inicijali} onChange={(e) => setInicijali(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 accent-black" />
              Inicijali
            </label>
            {inicijali && (
              <div className="mt-2 space-y-2 pl-1">
                <div>
                  <label className="text-xs text-muted-foreground">Šta piše (inicijali)</label>
                  <input value={monogramTekst} onChange={(e) => setMonogramTekst(e.target.value)}
                    placeholder="npr. P.P.  ili  M & P"
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Mesto</label>
                    <select value={monogramMesto} onChange={(e) => setMonogramMesto(e.target.value)}
                      className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm bg-white">
                      {MONOGRAM_MESTO.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Boja</label>
                    <select value={monogramBoja} onChange={(e) => setMonogramBoja(e.target.value)}
                      className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm bg-white">
                      {MONOGRAM_BOJA.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Font</label>
                    <select value={monogramFont} onChange={(e) => setMonogramFont(e.target.value)}
                      className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm bg-white">
                      {MONOGRAM_FONT.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
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
            Bazna veličina + korekcije = konačne mere (cm, pun obim). Korekcija preko ograničenja se blokira —
            znak da klijentu treba dati veći broj košulje, a ne širiti postojeći.
          </p>

          {!velicina && <p className="text-sm text-muted-foreground">Izaberi veličinu da vidiš mere.</p>}

          {mere && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1 font-medium">Mera</th>
                    <th className="text-right py-1 font-medium">Bazna</th>
                    <th className="text-center py-1 font-medium px-2">Korekcija</th>
                    <th className="text-right py-1 font-medium">Konačna</th>
                  </tr>
                </thead>
                <tbody>
                  {mere.map((m) => {
                    const lim = MERE_LIMITI.find((x) => x.key === m.key)!;
                    const van = deltaVanLimita(m.key, m.delta);
                    return (
                      <tr key={m.key} className="border-b last:border-0">
                        <td className="py-1.5">{m.label}{lim.limit !== null && <span className="text-[10px] text-muted-foreground"> (±{lim.limit})</span>}</td>
                        <td className="text-right tabular-nums text-muted-foreground">{m.base ?? "—"}</td>
                        <td className="text-center px-2">
                          <input type="number" value={delte[m.key] ?? ""} onChange={(e) => setDelta(m.key, e.target.value)} placeholder="0"
                            className={`w-16 border rounded px-2 py-1 text-sm text-center bg-white focus:outline-none focus:ring-2 ${van ? "border-red-400 focus:ring-red-400" : "focus:ring-black"}`} />
                        </td>
                        <td className={`text-right tabular-nums font-semibold ${van ? "text-red-600" : m.delta !== 0 ? "text-black" : "text-muted-foreground"}`}>{m.konacno ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {mere?.some((m) => deltaVanLimita(m.key, m.delta)) && (
            <p className="text-xs text-red-600">Neka korekcija je preko ograničenja — daj klijentu veći broj košulje.</p>
          )}
          {kombinovanoVanLimita && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Orukavlje + biceps zajedno prekoračuju ± {KOMBINOVANO_LIMIT.limit}.
            </p>
          )}

          {baza && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              <span className="font-medium">Ostale mere:</span>{" "}
              {baza.filter((b) => (OSTALE_MERE_SLOVA as readonly string[]).includes(b.letter)).map((b) => `${b.sr} ${b.obim}`).join(" · ")}
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
