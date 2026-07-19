# Progress Log: Millimeter — sprint do 20–25. jula

## Status: 🟡 In Progress

## Urađeno
- [2026-07-12] ✅ Faza 3 kompletna: cijeli app na modelu porudžbina→nalozi→stavke (lista, detalj, produkcija Kanban, dashboard, reports, profil klijenta) — live
- [2026-07-12] ✅ Review popravke: transakcije, mere u nalogu, štampa stavki, pretraga klijenata u wizardu, atomska doplata
- [2026-07-12] ✅ Poboljšanja: mobilna produkcija (vertikalne faze), izmjena stavki poslije kreiranja, otkazivanje umanjuje porudžbinu, prihod iz tabele uplata — sve testirano na živoj bazi
- [2026-07-13] ✅ Aleksandar POTVRDIO model (mejl): domaći nalog dobar, avansi dobri, faze razumije
- [2026-07-13] ✅ Pročitan `Nalog za kosulje.docx` (Desktop) — detaljna spec domaćeg naloga
- [2026-07-13] ✅ Nikolina vizija za Munro: redirect na Munro sajt + povratak (mejl)
- [2026-07-13] ✅ task_plan.md kreiran (Fable 5 analiza) — Opus preuzima izvršenje

## Urađeno (nastavak)
- [2026-07-13] ✅ B.1–B.3: sheet analiziran i očišćen — **673 čista klijenta za uvoz**, 222 bez broja, 43 za provjeru; 3 CSV-a na Desktopu. Otkriveno: porodice dijele broj → dedup pravilo dopunjeno (isti broj + različito ime = 2 osobe)

## U toku
- 🔄 Faza A: brze popravke iz feedbacka (Kragna, inicijali tekst, tux/skriveno kopčanje)

## Čeka
- ⏳ Matej: pregledati 3 CSV-a na Desktopu i odobriti uvoz (B.4)
- ⏳ Aleksandar: nazivi faza, tokovi Munro/gotov, opcije kragni/manžetni, ograničenja korekcija, spec gotovog proizvoda; lista "bez broja" njemu za presudu
- ⏳ Nikola: odgovor da li Munro status auto iz GoCreate ili ručno

## Blokeri
- 🔴 Nema tvrdih blokera — A i C mogu odmah; B.4 čeka Matejev pregled CSV-ova

## Novo pravilo komunikacije
- 📧 Nikola UVIJEK u CC na mejlovima (njegov zahtjev, 13.7)

## Urađeno (13.7 veče)
- [2026-07-13] ✅ Faza A live: Kragla→Kragna svuda, polje za tekst inicijala (wizard + stavke + štampa). Commit 406f659
- [2026-07-13] ✅ Munro API provjeren uživo: `Order/ByCustomerId` vraća status naloga (jedan klijent 8 naloga). Redirect potvrđen kao nužan (API ne pravi naloge). Vidi CLAUDE.md §24
- [2026-07-13] ✅ Munro mejl poslat obojici (Nikola CC) da usaglase pristup

## Novo (14.7 — Aleksandrovi odgovori)
- ✅ **Munro pristup PRIHVAĆEN od Aleksandra** (mejl 14.7): slaže se da nema paralelnih opcija kod nas („sve povlačiti iz Munra"); njegove „druge opcije" su bile o papirnom nalogu u lokalu iz kog kucaju mere u Munro. **Izričito traži povlačenje statusa** — „da nam bude dostupno čim otvorimo Klijenta u našem appu". Formalno: „Neka Nikola da krajnji sud" (a redirect je Nikolina ideja → praktično odobreno).
- ✅ Tabele: treću (dijele broj) potvrdio kao otac/sin ili greške u kucanju — lako rješava; drugu (bez broja) prolazi ime po ime, treba mu vremena. On pregleda naših 673 dok mi radimo dalje.
- 📥 **2025 je već spremna u istom spreadsheetu**; godine idu **do 2017**, dodaje ih postepeno i javlja. (Ranije godine imaju manje porudžbina.)

## Urađeno (15.7)
- [2026-07-15] ✅ **Faza C gotova i live** (commit 682ea28): Munro artikal = padajući meni vrsta, krojački detalji samo za `domaca`, napomena radniku. Otkriveno da su dugme „Otvori u GoCreate" (deep-link na FitProfile) i prikaz Munro statusa (detalj naloga + profil klijenta) **već postojali** — Aleksandrov zahtjev je time ispunjen.
- [2026-07-15] ✅ **Faza B.4 UVOZ GOTOV**: **678 klijenata** u bazi (3 → 681). Svi nose tag `notes = "Uvoz spiska 2026 (Aleksandar)"` + mjesece dolazaka.
  - 673 iz čistog spiska + **5 naknadno spašenih** (skripta ih je odbacila jer je uz broj bio dopisan tekst tipa `063-575004 (Bojan)`, `063-8168942 MAMA`, `Igor 063-200670`, `062-8802701 wa` — broj je ispravan, samo je čiji; original zapis sačuvan u napomeni). **Pouka za dalje godine: regex za telefon mora da vadi broj IZ teksta, ne da odbacuje red čim vidi slova.**
  - NIJE uvezeno: **216 stvarno bez broja** (od toga 133 potpuno prazno polje = stari klijent, 83 kontakt preko zaposlenog tipa „Dimi"/„Miljko"/„Mama") + **7 brojeva koji stoje u redu bez imena** (vjerovatno pripadaju klijentu iznad).
  - Provjereno: 0 bez telefona, 0 pogrešna firma, 0 slučajno sync-ovano u GoCreate, 63 inostrana broja, 18 brojeva dijeli po 2 osobe (očekivano — porodice).
  - ⚠️ 3 klijenta imaju ime upisano u polje prezime (`""/"Biljana Zena"`, `""/"Dosic"`, `""/"Mandaric"`) — greška izvornog sheeta, ostavljeni kako jesu, Aleksandar prolazi spisak.
  - **VAĐENJE ako zatreba:** `DELETE FROM customers WHERE notes LIKE 'Uvoz spiska 2026 (Aleksandar)%';` (čisto dok im se ne zakače nalozi)
  - Skripta: scratchpad `uvoz-klijenata.mjs` (dry-run po defaultu, `--izvrsi` za pravi uvoz)

## Urađeno (15.7, nastavak)
- [2026-07-15] ✅ **Faza E.1 gotova** (commit adc15cc): „preuzeto" pripisuje iznos klijentu (totalSpent + tier), korekcija ga skida; dupli klik ne duplira (čita se stanje prije promjene); **posjeta se broji po PORUDŽBINI** (svadba = 1 dolazak). Testirano na živoj bazi uz rollback.
- [2026-07-15] 🐛 **Nađen i popravljen bug:** pragovi lojalnosti bili zaostali iz EUR ere (Platinum ≥ 3000) — u RSD bi svaka košulja dala Platinum. Preračunato u dinare (60k/175k/350k) u novom `src/lib/loyalty.ts`. **⚠️ PITATI NIKOLU/ALEKSANDRA da potvrde iznose — to je poslovna odluka.**

## Urađeno (18.7 — Codex nezavisni review + Blok 1)
- [2026-07-18] 🔍 **Codex (GPT) nezavisni review** — 15 nalaza, 4 launch-blockera. Potvrdio: moj „dupli klik" test bio sekvencijalan a ne konkurentan (race postojao!), stari+novi statusni sistem mogli duplo knjižiti, cross-tenant rupe u starim akcijama, isActive se nije provjeravao.
- [2026-07-18] ✅ **Blok 1 ZAVRŠEN i live**: centralni `requireActiveUser` (isActive) u svih 11 action fajlova; FOR UPDATE lock u updateNalogStatus (+ simetričan izlazak iz preuzeto: reopen + poništavanje posjete); updateOrderStatus odbija purchase-backed naloge + sve scoped; saveMeasurements zaštićen; updateLoyaltyTier uklonjen iz javnog API-ja; doplata: lock + zabrana preplate; createSale potpuno prerađen; recalc CTE company filter; UI stari steper sakriven za porudžbine. **Dokazano konkurentnim testom sa 2 konekcije** (1 credit + 1 no-op).
- [2026-07-18] 📥 Aleksandar: sve godine u sheetu OSIM 2018 (čeka fajl). Matej treba da skine sheet → multi-year import.

## Urađeno (18.7 — sve godine klijenata)
- [2026-07-18] ✅ Multi-year analiza `Spisak klijenata za Mateja po godinama.xlsx` (2017–2026, 2018 prazan): 8323 reda sa brojem + 1209 bez + 1099 artikal-šum → **4384 jedinstvena klijenta** (dedup preko godina po broju+imenu). 273 „bez broja" razriješeno uparivanjem imena iz drugih godina; **500 ostaje bez broja** (za Aleksandra); 437 slučajeva isti broj/više imena (porodice ili nadimci — uvoze se kao posebni). Dry-run vs baza: 676 već unutra, **3708 NOVIH → ~4389 ukupno**. CSV-i: `klijenti-SVE-*.csv` (Desktop). Skripta: scratchpad `ocisti-sve-godine.py`. **ČEKA MATEJEVO „uvozi".**

## Urađeno (19.7 — odgovori stigli + performanse)
- [2026-07-19] 📧 **STIGLI ODGOVORI**: Nikola (novi zahtjevi: GoCreate kupci+porudžbine spajanje, artikli „iz Admina", top-po-godini filter, UBRZATI app) i Aleksandar (faze+nazivi POTVRĐENI, gotov proizvod detaljno — prost nalog + opciona korekcija, partneri: Doucals/Gran Sasso/Falke/Barmas/Gherardi/aksesoari/neprodati komadi; Munro tok stiže kao Word; loginovi DA — radnja svako svoj, proizvodnja JEDAN prost nalog; komentari po modulima stižu u fajlu)
- [2026-07-19] ⚡ **Performanse popravljene** (Nikolina primjedba): 10 DB indeksa; /customers server paginacija+pretraga; dashboard/reports agregati; wizard server pretraga. Puna lista od 4.346 klijenata više NE putuje u browser. Follow-up: appointments/corrections/sales pickeri.

## Ostalo iz Codex reviewa
- Blok 2: idempotency ključ na createPurchase (dupla porudžbina na retry)
- Blok 3: DB constraints/indeksi (apply_migration!), minimalna role matrica, validacioni sweep (appointments/corrections/suppliers/inventory), Beograd-datum helper, 6 ESLint grešaka
- Na kraju: ponovni Codex prolaz da potvrdi

## Sledeći korak
1. **PITATI klijenta:** pragovi lojalnosti u dinarima (Silver 60.000 / Gold 175.000 / Platinum 350.000) — naš predlog, neka potvrde.
2. Kad Matej skine ažurirani sheet (2025 je spremna, ide do 2017): dopuniti skriptu za više godina — **dedup PREKO godina po telefonu** (klijent iz 2019 i 2026 = jedan), uz istu zaštitu (isti broj + različito ime = 2 osobe). **Regex mora da vadi broj IZ teksta** (v. gore).
2. **Faza D** domaći nalog v2 po `Nalog za kosulje.docx` (šablon+korekcije, radnik na nalogu, boja materijala) + A.3 tux/skriveno — batch schema promjena, jedan RLS re-apply.
3. **Faza E** status→novac (čeka konačne nazive faza) + brisanje test podataka pred go-live.
4. **Faza F** go-live gate (security-review, repo private, Supabase Pro, lozinka, RLS provjera).
