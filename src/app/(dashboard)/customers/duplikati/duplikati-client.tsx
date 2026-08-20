"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Merge, X, Package, Phone, ShoppingBag } from "lucide-react";
import { mergeCustomers, type DupGroup, type VariantMatch } from "@/lib/actions/customers";

function Info({ munro, orders, totalSpent, lastVisit }: { munro: number; orders: number; totalSpent: number; lastVisit: string | null }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {munro > 0 && <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {munro} Munro</span>}
      {orders > 0 && <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {orders} nalog{orders === 1 ? "" : "a"}</span>}
      {totalSpent > 0 && <span>RSD {totalSpent.toLocaleString("sr-RS")}</span>}
      {lastVisit && <span>posl. {lastVisit}</span>}
      {munro === 0 && orders === 0 && totalSpent === 0 && <span className="italic">bez istorije</span>}
    </span>
  );
}

export function DuplikatiClient({ exactDupes, nameVariants }: { exactDupes: DupGroup[]; nameVariants: VariantMatch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Koje članove grupe spajamo u izabranog. Ako nema unosa za grupu — podrazumeva se SVI
  // (ponašanje kao ranije). Za grupe gde je isto ime ali RAZLIČITE osobe, skidaš kvačicu
  // s onih koji nisu ta osoba pa spojiš samo podskup (Aleksandrov komentar R4).
  const [mergeSel, setMergeSel] = useState<Record<string, Set<string>>>({});

  const isSel = (key: string, id: string) => (mergeSel[key] ? mergeSel[key].has(id) : true);
  const toggleSel = (key: string, id: string, allIds: string[]) =>
    setMergeSel((prev) => {
      const cur = new Set(prev[key] ?? allIds);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return { ...prev, [key]: cur };
    });

  const hide = (id: string) => setDismissed((s) => new Set(s).add(id));

  const doMerge = (tag: string, keepId: string, loseIds: string[], label: string) => {
    if (!window.confirm(label)) return;
    setErr(null);
    setBusy(tag);
    startTransition(async () => {
      try {
        await mergeCustomers(keepId, loseIds);
        hide(tag);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Greška pri spajanju.");
      } finally {
        setBusy(null);
      }
    });
  };

  const visibleGroups = exactDupes.filter((g) => !dismissed.has(`g-${g.key}`));
  const visibleVariants = nameVariants.filter((v) => !dismissed.has(`v-${v.noPhone.id}`));

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Nazad na klijente
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Mogući duplikati</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Spajanjem se sva istorija (Munro, nalozi, korekcije, termini, mere) prebacuje na klijenta koji ostaje,
          uzme se telefon ako fali, a duplikat se briše. Radio bira ko ostaje; kvačicom biraš koje zapise
          spajaš u njega. Ako je u grupi neko druga osoba (isto ime), skini mu kvačicu — ostaje zaseban klijent.
          Dugme Otvori prikaže profil (mere, istorija) u novom tabu da uporediš. Ako baš nisu isti, klikni Nisu isti.
        </p>
      </div>

      {err && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-md border border-red-200">{err}</div>}

      {/* Sekcija A — isto ime i prezime, različit broj */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Isto ime i prezime, različit broj ({visibleGroups.length})
        </h2>
        {visibleGroups.length === 0 && <p className="text-sm text-muted-foreground">Nema (ili su svi obrađeni).</p>}
        {visibleGroups.map((g) => {
          const allIds = g.members.map((m) => m.id);
          const keepId = keepers[g.key] ?? g.members[0].id;
          const keeper = g.members.find((m) => m.id === keepId)!;
          // Spajaju se samo označeni (podrazumevano svi), nikad izabrani-koji-ostaje
          const loseIds = g.members.filter((m) => m.id !== keepId && isSel(g.key, m.id)).map((m) => m.id);
          const tag = `g-${g.key}`;
          const confirmMsg = `Spoji ${loseIds.length} zapis(a) u ${keeper.firstName} ${keeper.lastName} (${keeper.phone?.trim() || "bez broja"})? Ostali se brišu, istorija im se prebacuje.`;
          return (
            <Card key={g.key}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {g.members[0].firstName} {g.members[0].lastName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{g.members.length} zapisa</span>
                </CardTitle>
                <button onClick={() => hide(tag)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Nisu isti
                </button>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {g.members.map((m) => {
                  const isKeep = keepId === m.id;
                  return (
                    <div key={m.id} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/40">
                      <input type="radio" name={`keep-${g.key}`} checked={isKeep} title="Ovaj ostaje"
                        onChange={() => setKeepers((k) => ({ ...k, [g.key]: m.id }))} className="mt-1" />
                      {isKeep ? (
                        <span className="mt-0.5 text-[10px] font-medium text-black shrink-0 w-10">ostaje</span>
                      ) : (
                        <input type="checkbox" checked={isSel(g.key, m.id)} title="Spoji ovog u izabranog"
                          onChange={() => toggleSel(g.key, m.id, allIds)} className="mt-1" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          {m.phone?.trim() ? m.phone : <span className="italic text-muted-foreground">bez broja</span>}
                          <Link href={`/customers/${m.id}`} target="_blank"
                            className="ml-auto text-xs text-blue-600 hover:underline shrink-0">otvori</Link>
                        </div>
                        <Info munro={m.munro} orders={m.orders} totalSpent={m.totalSpent} lastVisit={m.lastVisit} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => doMerge(tag, keepId, loseIds, confirmMsg)}
                    disabled={(isPending && busy === tag) || loseIds.length === 0}
                    className="text-sm bg-black text-white px-3 py-1.5 rounded-md hover:bg-black/80 disabled:opacity-50 flex items-center gap-1.5">
                    <Merge className="w-4 h-4" /> {busy === tag ? "Spajam..." : `Spoji označene u izabranog (${loseIds.length})`}
                  </button>
                  <span className="text-xs text-muted-foreground">radio = ostaje; skini kvačicu ako je druga osoba</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Sekcija B — isto prezime, moguća varijanta imena (Eki/Elvir) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Bez broja iz Munra + isto prezime ({visibleVariants.length})
        </h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Levo je klijent bez broja (iz Munra, ima istoriju), desno mogući isti čovek koji već ima broj. Dugme Zadrži ovog znači da taj ostaje, a Munro istorija mu se pripoji.
        </p>
        {visibleVariants.length === 0 && <p className="text-sm text-muted-foreground">Nema (ili su svi obrađeni).</p>}
        {visibleVariants.map((v) => {
          const tag = `v-${v.noPhone.id}`;
          return (
            <Card key={v.noPhone.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {v.noPhone.firstName} {v.noPhone.lastName}
                  <span className="ml-2 text-xs font-normal text-amber-600">bez broja · {v.noPhone.munro} Munro</span>
                </CardTitle>
                <button onClick={() => hide(tag)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Nisu isti
                </button>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {v.candidates.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.firstName} {c.lastName}
                        <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                      </div>
                      <Info munro={c.munro} orders={0} totalSpent={c.totalSpent} lastVisit={c.lastVisit} />
                    </div>
                    <button
                      onClick={() => doMerge(tag, c.id, [v.noPhone.id], `Zadrži ${c.firstName} ${c.lastName} (${c.phone}) i pripoji Munro istoriju od ${v.noPhone.firstName} ${v.noPhone.lastName}? Drugi zapis se briše.`)}
                      disabled={isPending && busy === tag}
                      className="text-xs bg-black text-white px-3 py-1.5 rounded-md hover:bg-black/80 disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                      <Merge className="w-3.5 h-3.5" /> {busy === tag ? "..." : "Zadrži ovog, spoji"}
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
