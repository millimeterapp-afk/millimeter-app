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

## Sledeći korak
1. **Faza C kreće** (Munro slim nalog + dugme ka GoCreate + status iz Munra na nalogu i profilu klijenta) — Aleksandar potvrdio, Nikolin „krajnji sud" je formalnost jer je pristup njegova ideja. Napomena: profil klijenta VEĆ vuče GoCreate naloge — provjeriti da je status istaknut.
2. **B.4 uvoz 673** — čeka Matejev „uvozi" (Aleksandrov pregled ide paralelno; korekcije se kasnije apliciraju kao izmjene).
3. Kad Matej skine ažurirani sheet (2025+): dopuniti skriptu za više godina (dedup PREKO godina po telefonu, kolona godine/mjeseci).
4. A.3 (tux/skriveno) batch sa Fazom D.
