# Task Plan: Millimeter — završetak do 20–25. jula
**Datum:** 2026-07-13
**Prioritet:** High
**Procenjena kompleksnost:** 4/5
**Rok:** Nikola želi kraj 20–25. jula (7–12 dana od danas)

## Cilj
Aplikacija spremna za go-live: feedback iz Aleksandrovog mejla ugrađen, klijenti uvezeni, Munro tok po Nikolinoj zamisli, bezbjednosni gate prošao.

## Kontekst
Aleksandar testirao novi model (porudžbina→nalozi→stavke) i POTVRDIO da je dobar:
domaći nalog "izgleda dobro", avansi "izgleda dobro", faze "razumem".
Poslao: (1) mejl sa konkretnim popravkama, (2) dokument `Nalog za kosulje.docx`
(detaljna spec domaćeg naloga — pročitan, na Desktopu), (3) Google Sheet spisak
klijenata 2026 (na Matejev mejl). Nikola (vlasnik) se uključio: Munro nalog =
redirect na Munro sajt + povratak u app; CC Nikola na svim mejlovima.

## Koraci

### Faza A: Brze popravke iz feedbacka (13–14.7) — ništa ne čeka
- [x] A.1 "Kragla" → "Kragna" svuda (wizard, detalj, print, edit modal, korekcije) — 13.7
- [x] A.2 Inicijali: SLOBODNO TEKST POLJE šta piše (P.P., M & P) — wizard (monogramText → monogramData.tekst), prikaz u Stavkama i na štampanom nalogu — 13.7
- [ ] A.3 Tux dugmići + skriveno kopčanje — 2 opciona checkboxa (iz docx-a). ODLOŽENO za Fazu D (traži schema promjenu → batch-ovati sa boja materijala, jedan RLS re-apply)
- [x] A.4 Odgovor Aleksandru poslat (mejl + WA), Munro mejl obojici (redirect vs full — uskladiti) — 13.7

### Faza B: Uvoz klijenata (14–16.7) — kritični put
- [x] B.1 Matej skida 2026 sheet kao XLSX/CSV — `Spisak klijenata za Mateja.xlsx` na Desktopu (13.7)
- [x] B.2 Analiza sheeta (13.7): 1161 klijent-redova, 7 mjeseci (jan–jul 2026); telefoni: 780 standard + 102 inostrana + 3 nestandardna, 162 prazna, 113 tekst (kontakt-osoba tipa "Dimi"/"Viber"); 30 bilješki; 212 ponovljenih imena kroz mjesece (isti klijent više porudžbina)
- [x] B.3 Skripta za čišćenje urađena i istestirana (13.7): **673 čista klijenta za uvoz** (610 domaćih + 63 inostrana), 222 jedinstvena bez broja, 43 za ručnu provjeru. ⚠️ VAŽNO otkriće: 18 brojeva dijele RAZLIČITA imena (porodica dijeli telefon — npr. otac/sin) → dedup SAMO po telefonu bi spojio dvije osobe u jednu; pravilo dopunjeno: isti broj + isto ime = spoji; isti broj + različito ime = dvije osobe, u listu za provjeru. Izlazi na Desktopu (PII — NE ide u repo dok je javan): `klijenti-2026-cisto.csv`, `klijenti-2026-bez-broja.csv`, `klijenti-2026-za-proveru.csv`. Skripta: scratchpad `ocisti-spisak.py` (prebaciti u `scripts/` kad repo postane private)
- [ ] B.4 Probni uvoz na lokalnoj kopiji podataka → pregled sa Matejem → pravi uvoz u Supabase (customers tabela, company_id!)
- [ ] B.5 Izvještaj Aleksandru: koliko uvezeno, koliko duplikata, koliko bez broja; pravila za godine unazad (on samo sturo spaja, mi čistimo)
- [ ] B.6 NAPOMENA: uvezeni klijenti se NE sinhronizuju automatski u GoCreate (sync ide tek kad se pravi Munro nalog)

### Faza C: Munro nalog po Nikolinoj zamisli (15–17.7) — ✅ ODOBRENO od Aleksandra 14.7
- [x] C.1 Slim forma za Munro nalog u wizardu (15.7): artikal = padajući meni `MUNRO_ARTIKLI` (dvodelno/trodelno odelo, sako, pantalone, prsluk, košulja, knit, obuća, aksesoar); BEZ krojačkih detalja (kragna/manžetna/šablon/monogram sad samo za `domaca`); napomena radniku da detalje unosi u Munru
- [x] C.2 Dugme "Otvori u GoCreate" — VEĆ POSTOJALO, deep-link `gocreate.nu/Customer/Detail/{gcId}?redirectToFitProfileTab=True` + fallback dugme "Sync u GoCreate" ako klijent nije sinhronizovan
- [x] C.3 Prikaz GoCreate naloga sa statusom — VEĆ POSTOJALO na detalju naloga (GC_STATUS_COLORS) I na profilu klijenta (tabela: nalog, tip, tkanina, **status**, isporuka, HITNO flag). Aleksandrov zahtjev „dostupno čim otvorimo Klijenta" = već ispunjen
- [x] C.4 Odgovor stigao: Aleksandar traži povlačenje statusa (✅ radi), slaže se da nema paralelnih opcija kod nas. „Neka Nikola da krajnji sud" — formalnost, redirect je Nikolina ideja
- [ ] C.5 OSTALO: uparivanje GoCreate naloga sa NAŠIM nalogom kad klijent ima više Munro komada (`Order/ByCustomerId` vraća po klijentu). Trenutno se prikazuju svi klijentovi Munro nalozi — za većinu slučajeva dovoljno; uparivanje po OrderType/datumu tek ako zatraže

### Faza D: Domaći nalog v2 — spec iz docx (16–18.7, dio čeka definicije)
- [ ] D.1 Header naloga: izbor "novi šablon / postojeći šablon" + koji kroj korišćen (Munro slim / Naš slim / Olimp već postoji kao šablon polje)
- [ ] D.2 Radnik koji pravi nalog: prikazati createdBy na nalogu/printu (imamo 2 app naloga a 5 radnika — pitati da li trebaju posebni nalozi za radnike prije go-live)
- [ ] D.3 Mere: vrat/dužina/rukav/zglob brojke (ima); grudi, struk, stomak, bokovi, aksla, satla, biceps, podlaktica kao +/- KOREKCIJE na šablon — pripremiti UI, ali OGRANIČENJA (max +obim) čekaju njihove definicije
- [ ] D.4 Materijal sa oznakom boje (polje boja uz materijal)
- [ ] D.5 ⏳ Opcije kragni/manžetni detaljno — čeka Aleksandrov spisak (nije blokada)

### Faza E: Status→novac + čišćenje (18–20.7)
- [ ] E.1 Kad nalog pređe u "preuzeto": ažurirati customer.totalSpent/visitCount/loyalty (novac iz purchase.paidAmount srazmjerno, NE duplo za više naloga iste porudžbine)
- [ ] E.2 Obrisati test podatke (NAL-2026-0001 "Test košulja", NAL-2026-0002 "TEST", Test Testovic klijent)
- [ ] E.3 Konačni nazivi faza — čeka Aleksandra/Nikolu (imamo predloge, rename je trivijalan)

### Faza F: Go-live gate (20–25.7)
- [ ] F.1 /security-review pun prolaz nad cijelim kodom
- [ ] F.2 /spartan: typecheck → lint → test → review
- [ ] F.3 GitHub repo → Private
- [ ] F.4 Nikolina lozinka promijenjena + uklonjena odasvud
- [ ] F.5 Supabase Pro uključen (dnevni bekapi) — odluka već donijeta, samo pred go-live
- [ ] F.6 Provjeriti RLS na svim tabelama (poslije svakog drizzle push!)
- [ ] F.7 Nalozi za 5 radnika ako je potvrđeno u D.2

## Edge Cases i rizici
- Excel: isti klijent sa dva različita broja (stari/novi) → dedup po telefonu ga NEĆE spojiti — prihvatljivo, Aleksandar presuđuje ručno kasnije
- Klijenti bez telefona → ne smiju blokirati uvoz; posebna lista
- Prazni redovi u sheetu = više artikala istog klijenta → skripta MORA spajati na prethodno ime, ne praviti prazne klijente
- Munro redirect: GoCreate sesija ističe → radnik mora biti ulogovan u GoCreate u browseru (to je njihov postojeći tok, ne rješavamo mi)
- Rok 20–25.7 je Nikolina želja: Faze A–C su obavezne, D djelimično čeka njih — komunicirati šta od NJIH zavisi (nazivi faza, opcije, ograničenja)
- drizzle push briše RLS — poslije svake schema promjene obavezno vratiti RLS (CLAUDE.md §14)

## Definition of Done
- [ ] Build + typecheck + lint čisti
- [ ] Novac-logika testirana protiv žive baze (kao do sada: tvrdnja + provjera)
- [ ] /security-review i /spartan prošli
- [ ] Aleksandar potvrdio na produkciji (telefon!)
- [ ] Klijenti uvezeni i pregledani
- [ ] CLAUDE.md + progress.md ažurirani

## Fajlovi koji se menjaju
- `src/app/(dashboard)/orders/new/new-order-client.tsx` — A.1–A.3, C.1, D.1–D.4
- `src/app/(dashboard)/orders/[id]/order-detail-client.tsx` — A.1, A.2 (print!), C.2–C.3, D.2
- `src/lib/actions/purchases.ts` — E.1 (status→novac)
- `src/lib/db/schema.ts` — D.4 (boja materijala) ako zatreba; PAZI na RLS poslije push-a
- novi: `scripts/import-klijenti.py` — B.3 skripta za čišćenje
- `CLAUDE.md`, `progress.md` — tekuće

## Blokeri
- ⏳ Aleksandar: konačni nazivi faza + tokovi za Munro/gotov proizvod
- ⏳ Aleksandar: opcije kragni/manžetni, ograničenja +/- korekcija mera, spec forme za gotov proizvod
- ⏳ Matej: skinuti Google Sheet (XLSX) — Claude nema pristup Gmail/Drive
- ⏳ Nikola/Aleksandar: odgovor na C.4 (auto status iz GoCreate ili ručno)
- ⏳ Odluka: posebni app nalozi za 5 radnika (D.2)
