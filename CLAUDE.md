# Millimeter App — CLAUDE.md

model: claude-sonnet-4-6

Interni poslovni sistem za krojačku firmu (CRM + nalozi + produkcija + zalihe + prodaja). Sav UI tekst je na srpskom jeziku. **Uvek komuniciraj isključivo na srpskom jeziku — ekavica (ne ijekavica). Primer: "razumem", "primer", "sledeći", "ovde", "vreme" — nikad "razumijem", "primjer", "sljedeći", "ovdje", "vrijeme".**

### Promptovi (skillovi) — koristiti aktivno

Fajlovi su u `C:\Users\acer\.claude\prompts\`:

| Prompt | Kada koristiti |
|---|---|
| `tech-lead.md` | Pre svakog novog featuri ili integracije |
| `api-verification.md` | Pre pisanja bilo kakvog API integration koda |
| `debug-production.md` | Kada nešto ne radi u produkciji |
| `security-audit.md` | Pre svakog deploja |
| `codebase-audit.md` | Na početku sesije ili kada novi developer preuzima |

**Naučeno iz grešaka:** GoCreate integracija — 20+ test poziva zbog pretpostavki umesto provere. Phone vs MobileNumber bug koji je prošao bez detekcije. CLAUDE.md bio na public repo sa osetljivim podacima.

### Komunikacija sa klijentom — KRITIČNA PRAVILA

Klijent je Nikola Miljković, suvlasnik firme sa prihodom ~€850.000. Svaka poruka koja ide Nikoli mora biti besprekorna.

**Pre sastavljanja bilo koje poruke za Nikolu:**
1. Proveri kod, bazu ili stvarni test rezultat za svaku tvrdnju
2. Ako nisi 100% siguran u neku informaciju — eksplicitno reci to korisniku PRE nego što napišeš poruku
3. Nikad ne pretpostavljaj da nešto radi — potvrdi stvarnim dokazom
4. Ako korisnik pita "jesi siguran?" — to znači da si pogrešio, odmah ispravi

**Primer loše prakse (ne raditi):**
- Pisati "sistem automatski radi X" bez provere da li X zaista radi
- Sastavljati poruke na osnovu pretpostavki
- Čekati da korisnik ispravi netačne informacije

### Token optimizacija — duže sesije
- Koristiti `/clear` kada kontekst postane dugačak
- Posle `/clear` — CLAUDE.md se automatski učitava (nije potrebno ručno uploadovati)
- Aktivni skillovi za ovaj projekat: `/security` (API ključevi) + `/spartan` (quality gate)
- Ne pozivati skillove koji nisu potrebni za trenutni zadatak

---

## 1. Tech Stack

| Sloj | Tehnologija | Napomena |
|---|---|---|
| Framework | Next.js 15 (App Router) | `src/` folder, server components po defaultu |
| Language | TypeScript 5 | Strict mode |
| Styling | Tailwind CSS + shadcn/ui | Komponente u `src/components/ui/` |
| Database | PostgreSQL via Supabase | Managed cloud instance |
| ORM | Drizzle ORM | Schema u `src/lib/db/schema.ts` |
| Auth | Supabase Auth | SSR setup sa `@supabase/ssr` |
| Charts | Recharts | Na dashboard i reports stranicama |
| Barcodes | react-barcode | Code128 format, print via JSBarcode CDN |
| Icons | Lucide React | |
| State | React `useState` / `useTransition` | Nema Zustand — jednostavan scope |
| Excel | xlsx (npm) | Parsiranje i generisanje Excel fajlova na serveru |

---

## 2. Infrastruktura i nalozi

### ⚙️ Model naloga (VAŽNO — pročitati prvo)
Projekat živi na **posebnom Google nalogu klijenta** (`millimeterapp@gmail.com` → GitHub `millimeterapp-afk`), da bi mogao da se preda Nikoli. Matej radi sa **svog glavnog naloga** (`matejnevic07@gmail.com`) preko MCP konektora (Supabase + Vercel u Claude.ai).

Da bi MCP sa glavnog naloga vidio projekat, glavni nalog je dodat kao **Administrator** u Supabase organizaciju klijenta (Nikola ostaje Owner). Vercel deploy ide automatski preko GitHub push-a — Vercel MCP nije nužan.

**Pravilo za buduće projekte:** svaki klijent = poseban Google nalog (GitHub+Vercel+Supabase). Matej se doda kao Administrator u Supabase org + kolaborator na GitHub repo, i radi sa svog Claude naloga. Pri predaji — samo skineš svoj pristup, sve ostaje klijentu.

**Čišćenje duplih (gotovo 19.6):** zombi `millimeter-app.vercel.app` (Matejev glavni Vercel) — OBRISAN. Stari Supabase `xejjwvsnnlmwrwcxeyki` (INACTIVE, glavna org) — OBRISAN. Živi je SAMO `millimeter-app-lyart.vercel.app` + Supabase `zbmjhmvpavojahhnrkzp` na millimeterapp-afk nalogu.

**MCP pristup potvrđen (19.6):** Matejev glavni nalog dodat kao Administrator u Supabase org "Millimeter" (`kgnfmsugfbbnrxlmuoyg`). Supabase MCP sa Matejevog Claude naloga vidi i čita živi projekat. Radi se sa glavnog naloga, projekat ostaje Nikolin.

### Supabase (baza podataka)
- **Projekat:** `zbmjhmvpavojahhnrkzp`
- **Region:** `eu-central-1` (Frankfurt)
- **Dashboard:** https://supabase.com/dashboard/project/zbmjhmvpavojahhnrkzp
- **DB lozinka:** <vidi .env.local / password manager — NE commitovati>
- **Nalog:** millimeterapp@gmail.com

### GitHub (kod)
- **Repo:** https://github.com/millimeterapp-afk/millimeter-app (Public)
- **Nalog:** millimeterapp-afk
- **Email:** millimeterapp@gmail.com

### Vercel (hosting)
- **Projekt:** https://vercel.com/millimeter-app-s-projects/millimeter-app
- **Live URL:** https://millimeter-app-lyart.vercel.app
- **Nalog:** millimeterapp-afk (GitHub login)
- **Plan:** Hobby (besplatno)

### App admin nalog
- **Email:** admin@millimeter.me
- **Lozinka:** <vidi password manager — NE commitovati>
- **companyId:** e44571bb-e3e9-4a11-8ea4-70cb69b0960d
- **Role:** owner

### `.env.local` — svi kredencijali (čitaj ovaj fajl za prave vrijednosti)
Fajl se nalazi na: `C:\Users\acer\Desktop\millimeter-app\.env.local`
Sadrži: SUPABASE URL, ANON KEY, SERVICE ROLE KEY, DATABASE_URL, GOCREATE kredencijale.

### GoCreate API kredencijali (u .env.local)
- **GOCREATE_USERNAME:** MILL_API
- **GOCREATE_PASSWORD:** (vidi .env.local)
- **GOCREATE_AUTH_TOKEN:** (vidi .env.local)
- **API base:** https://api.gocreate.nu
- **Shop ID:** 2293 (Millimeter CC)

### GoCreate web login (za ručni pristup)
- **URL:** https://gocreate.nu/Login/Login
- **Username:** Millimeter
- **Lozinka:** <vidi password manager — NE commitovati>

**DB konekcija:** PgBouncer transaction pooler (port 6543), `prepare: false`
**Za migracije** koristiti session pooler (port 5432) sa `--force`:
```powershell
$env:DATABASE_URL="postgresql://postgres.zbmjhmvpavojahhnrkzp:<DB_LOZINKA>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"; npx drizzle-kit push --force
```

### ⚠️ Supabase Free tier — DJELIMIČNO RIJEŠENO
Cron job je implementiran i commitovan: `src/app/api/cron/keepalive/route.ts` + `vercel.json`.
**`CRON_SECRET` env varijabla JOŠ NIJE dodana na Vercel** — bez nje cron ne radi.
Dodati na Vercel: Settings → Environment Variables → Key: `CRON_SECRET`, Value: `millimeter-keepalive-2026`

---

## 3. Pokretanje projekta

```bash
npm install
npm run dev          # → http://localhost:3000
npx next build       # build provjera
```

---

## 4. Arhitektura

### Folder struktura
```
src/
  app/
    (auth)/           — login stranica (nije zaštićena)
    (dashboard)/      — sve zaštićene stranice (layout.tsx provjerava auth)
      dashboard/      — page.tsx (server) + dashboard-client.tsx (client)
      customers/      — lista + [id]/ profil klijenta
      appointments/   — termini, week view + list view
      orders/         — lista + new/ + [id]/ detalji
      production/     — kanban board
      corrections/    — lista korekcija
      inventory/      — materijali + gotova roba
      barcodes/       — generisanje + skeniranje + štampa
      sales/          — prodaja + istorija
      suppliers/      — dobavljači + fakture
      reports/        — finansijski izvještaji
      companies/      — upravljanje firmama (placeholder)
      settings/       — podešavanja
    login/
  components/
    ui/               — shadcn komponente
    app-sidebar.tsx   — sidebar navigacija
    app-header.tsx    — header sa user info
  lib/
    db/
      index.ts        — Drizzle singleton klijent
      schema.ts       — sve tabele, relacije i TypeScript tipovi
    actions/          — server actions po modulu
    supabase/
      client.ts       — browser Supabase klijent
      server.ts       — server Supabase klijent (cookies)
    utils.ts          — cn() helper
  middleware.ts       — auth zaštita ruta
```

### Pattern za svaku stranicu
```
page.tsx (server component)
  └── učitava podatke via server actions
  └── renderuje *-client.tsx sa props

*-client.tsx ("use client")
  └── sav interaktivni UI
  └── mutacije via server actions + useTransition + router.refresh()
```

### Multi-company arhitektura
- Svaki zapis u bazi ima `company_id`
- `getCurrentUser()` helper u svakom actions fajlu: dohvata auth usera → db usera → provjerava `companyId`
- Svi queriji filtriraju po `company_id` (nema RLS — filtriranje na aplikacijskom nivou)

---

## 5. Baza podataka — sve tabele

### Enums
```
user_role:        owner | store_manager | store_employee | production_employee | accountant
order_status:     draft | confirmed | in_production | ready | delivered | cancelled
order_type:       custom | ready_made | correction
production_status: queued | in_progress | done | sent_to_store
correction_status: open | in_production | resolved | not_resolved
payment_method:   cash | card | transfer
movement_type:    receive | reserve | release | sell | adjust
```

### Tabele

| Tabela | Opis | Ključna polja |
|---|---|---|
| `companies` | Firme | name, country, currency |
| `users` | Korisnici (id = Supabase Auth UUID) | email, fullName, role, companyId |
| `customers` | Klijenti firme | firstName, lastName, phone, templateNumber, loyaltyTier, totalSpent |
| `customer_measurements` | Merenja klijenta (JSONB) | customerId, label, data{vrat,grudi,struk...} |
| `orders` | Svi nalozi | orderNumber, customerId, status, dueDate, totalAmount, paidAmount, paymentStatus, **productionFlow** |
| `orders` (custom fields) | Denormalizovano za nalog po mjeri | item, material, collarType, cuffType, fitType, measurementSnapshot, monogramData |
| `material_reservations` | Rezervacije materijala po nalogu | orderId, materialId, quantityReserved, status |
| `production_tasks` | Produkcijski zadaci | orderId, assignedTo, priority, status, dueDate |
| `corrections` | Korekcije/izmjene | orderId, customerId, correctionType, description, status |
| `materials` | Materijali (tkanine, dugmad...) | name, code, barcode, unit, currentStock, reservedStock, reorderLevel, lastPurchasePrice |
| `inventory_items` | Gotova roba | name, sku, barcode, quantity, reservedQuantity, salePrice, costPrice |
| `inventory_movements` | Kretanja zaliha (log) | itemType, itemId, movementType, quantity |
| `sales` | Prodajni dokumenti | saleNumber, customerId, paymentMethod, totalAmount |
| `sale_items` | Stavke prodaje | saleId, itemName, inventoryItemId, quantity, unitPrice |
| `payments` | Uplate | referenceType, referenceId, amount, paymentDate |
| `loyalty_events` | Loyalty transakcije | customerId, eventType, points |
| `appointments` | Zakazani termini | customerId, scheduledAt, durationMinutes, type, status |
| `suppliers` | Dobavljači | name, contactPerson, email, phone, country |
| `supplier_invoices` | Ulazne fakture | supplierId, invoiceNumber, currency, subtotal, totalAmount, status |
| `supplier_invoice_items` | Stavke fakture | invoiceId, materialId, quantity, unitPrice, finalUnitCost |
| `invoice_additional_costs` | Troškovi na fakturu | invoiceId, costType, amount |
| `audit_logs` | Revizija promjena | userId, action, entityType, entityId, oldValues, newValues |

---

## 6. Server Actions — sve funkcije

### `src/lib/actions/customers.ts`
- `getCustomers(search?)` — lista svih klijenata kompanije
- `getCustomer(id)` — profil sa merenjima, narudžbinama, korekcijama
- `createCustomer(data)` — novi klijent
- `updateCustomer(id, data)` — izmjena klijenta
- `saveMeasurements(customerId, data)` — sačuvaj merenja (deaktivira stara)
- `addHistoricalPurchase(customerId, data)` — retroaktivna kupovina (RET- prefix)
- `updateLoyaltyTier(customerId, totalSpent)` — ažurira loyalty tier
- `deleteCustomer(id)` — soft delete (deletedAt)
- `generateCustomerTemplate()` — generiše Excel template za uvoz, vraća base64
- `importCustomers(formData)` — uvozi klijente iz Excel-a, preskače duplikate po telefonu

### `src/lib/actions/orders.ts`
- `getOrders()` — lista svih naloga sa customer join
- `getOrder(id)` — detalji sa customer, tasks, corrections
- `createOrder(data)` — novi nalog, polja: productionFlow, collarType, cuffType, fitType, measurementSnapshot (13 mjera), monogramData
- `updateOrder(id, data)` — izmjena naloga
- `updateOrderStatus(id, status)` — promjena statusa
- `updatePayment(id, amount, method)` — uplata na nalog
- `sendToProduction(id, data)` — kreira production_task
- `deliverOrder(id)` — isporuka, ažurira customer.totalSpent, loyalty
- `cancelOrder(id)` — otkazivanje

### `src/lib/actions/inventory.ts`
- `getMaterials()` / `createMaterial(data)` / `updateMaterial(id, data)`
- `getInventoryItems()` / `createInventoryItem(data)` / `updateInventoryItem(id, data)`
- `receiveMaterial(materialId, quantity, note?)` — prijem + movement log
- `receiveInventoryItem(itemId, quantity, note?)` — prijem + movement log
- `generateMaterialBarcode(materialId)` — `MM-MAT-XXXXXXXX` format
- `generateInventoryItemBarcode(itemId)` — `MM-INV-XXXXXXXX` format
- `lookupByBarcode(barcode)` — {type, item} ili null
- `getInventoryMovements()` — zadnjih 100 kretanja
- `importMaterials(formData)` — uvozi materijale iz Excel-a (Naziv, Šifra, Barkod, Grupa, JM, "Nab. cena sa PDV")
- `importInventoryItems(formData)` — uvozi gotovu robu iz Excel-a (Naziv, Šifra, Grupa, Cena)

### Ostali actions
- `production.ts` — getProductionTasks, updateTaskStatus, addProductionNote
- `corrections.ts` — getCorrections, createCorrection, updateCorrectionStatus, sendCorrectionToProduction
- `sales.ts` — getSales, createSale
- `appointments.ts` — getAppointments, createAppointment, updateAppointmentStatus, updateAppointment, deleteAppointment
- `suppliers.ts` — getSuppliers, createSupplier, getSupplierInvoices, createSupplierInvoice, postInvoice
- `auth.ts` — login/logout helperi
- `settings.ts` — getCompanySettings, updateCompanySettings

---

## 7. Stranice (Routes)

| Route | Opis | Status |
|---|---|---|
| `/login` | Stranica za prijavu | ✅ |
| `/dashboard` | KPI kartice, grafikon, termini danas | ✅ |
| `/customers` | Lista klijenata (Template + Uvezi Excel) | ✅ |
| `/customers/[id]` | Profil klijenta (merenja, nalozi, korekcije, loyalty) | ✅ |
| `/appointments` | Termini — week view + list view | ✅ |
| `/orders` | Lista naloga (Munro badge, filteri) | ✅ |
| `/orders/new` | Wizard 5 koraka: Klijent → Detalji → Mjerenja → Materijal → Potvrda | ✅ |
| `/orders/[id]` | Detalji naloga | ✅ |
| `/production` | Kanban board (samo Millimeter nalozi) | ✅ |
| `/corrections` | Lista korekcija | ✅ |
| `/inventory` | Materijali + gotova roba (Uvezi Excel za oba taba) | ✅ |
| `/barcodes` | Generisanje, skeniranje i štampa barkodova | ✅ |
| `/sales` | POS prodaja + istorija | ✅ |
| `/suppliers` | Dobavljači + fakture | ✅ |
| `/reports` | Finansijski izvještaji | ✅ |
| `/settings` | Podešavanja firme | ✅ |

---

## 8. Faza 1 — Implementirano (Maj 2026)

### ✅ Zadatak 1 — Dva toka produkcije
- `productionFlow` kolona na `orders` tabeli (default: "millimeter")
- Toggle Millimeter / Munro u Step 1 wizarda
- Munro badge (ljubičast) na listi naloga
- Munro nalozi ne idu na produkcijski board

### ✅ Zadatak 2 — Proširena forma za nalog košulje
Wizard ima 5 koraka. Forma odgovara tačno njihovom Excel nalogu (`Nalog za Kosulju.xlsx` — provjereno):
- **Šablon + veličina:** Munro slim (38–45), Naš slim (38–44), Olimp (S–XXXL)
- **Manžetna (cuffType):** Jednostruka / Dupla / Francuska
- **Inicijali/monogram:** pozicija (Štej/Manžetna/Prednjica) + boja + font
- **13 mjerenja (cm):** vrat, grudi, struk, stomak, kukovi, dužina naprijed/pozadi, aksla, leđa, rukav, biceps, podlaktica, zglob

### ✅ Zadatak 3 — Uvoz materijala
- 1.933 materijala uvezeno iz `repro materijali.xlsx` — sve u bazi
- Server akcija `importMaterials(formData)`

### ✅ Zadatak 4 — Uvoz Munro artikala
- 92 Munro odijela/prsluka (PC01–PC30) uvezena iz `gotova odela.xlsx` — sve u bazi
- Server akcija `importInventoryItems(formData)`

### ✅ Zadatak 5 — Template + uvoz klijenata
- Download Excel template, upload popunjenog fajla
- `importCustomers(formData)` — preskače duplikate po telefonu

### ✅ Ostale izmjene (Maj 2026)
- Valuta: `€` → `RSD` u svim fajlovima
- Lokacija: `Crna Gora / Podgorica` → `Srbija / Beograd` u sidebaru, login stranici, PDF nalogu

---

## 9. Stanje podataka u bazi

- **Materijali:** 1.933 uvezena (stock = 0, samo katalog)
- **Gotova roba:** 92 Munro artikla (PC01–PC30, cijene u RSD)
- **Klijenti:** 0 (Nikola priprema bazu, osoba radi 5 dana na formatiranju)
- **Nalozi:** 0
- **Korisnici:** samo admin@millimeter.me

---

## 10. Poslovni kontekst

### Firma
**MIN CLOTHING DOO (Millimeter)** — premium krojačnica u Beogradu.
- **Nikola Miljković** — 50% vlasnik, primarni kontakt
- **Miloš Ivanović** — 50% vlasnik
- Prihod 2025: ~€850.000, ~10 zaposlenih
- Lokacija: Beograd, Srbija (Omladinskih brigada 86g)
- Košulje: od 12.990 RSD | Odijela: 77.490–97.990 RSD
- Nikola je prihvatio ponudu i cijenu za Fazu 1 (€500)

### Munro / GoCreate — kompletna analiza (Maj 2026)

**Munro Tailoring** (munro-tailoring.com) je B2B platforma za custom menswear iz Amsterdama. Imaju 500+ partnerskih radnji u 34 zemlje. Millimeter je jedan od partnera.

**GoCreate** (gocreate.nu) je softverska platforma koju Munro koristi za upravljanje narudžbinama. Nikola se loguje na gocreate.nu da kreira naloge.

#### GoCreate nalozi (Millimeter ima 3)
| Shop | ID | Tip |
|---|---|---|
| Millimeter (CC) | 2293 | Kartično plaćanje |
| Millimeter (invoice) | 2855 | Faktura, kreditna linija ~8.860€, na 70% |
| Millimeter Montenegro (CC) | 3100 | Crnogorska radnja |

Login: username=Millimeter, password=<GoCreate lozinka — vidi password manager, NE commitovati>

#### GoCreate REST API (api.gocreate.nu)
Kompletna lista endpointa — ništa više ne postoji:

**Order (samo čitanje + status update, NEMA kreiranja):**
- `POST /Order/ByCustomerId` — svi nalozi klijenta
- `POST /Order/ByDate` / `ByOrderdate` — nalozi po datumu
- `POST /Order/ByOrderNumber` — detalji naloga (mjere, tkanina, dizajn opcije, cijene, branding)
- `POST /Order/OrderDeliveryInfo` — datum isporuke
- `POST /Order/OrderDeliveryInfoByStatus` — nalozi po statusu
- `POST /Order/OrderPricingInfo` — cijene
- `POST /Order/UpdateStatus` — promijeni status (Processed/On hold/Delivered/Cancelled/Deposit paid)

**Customer:**
- `POST /Customer/Add` — dodaj klijenta, vraća GoCreate CustomerID
- `POST /Customer/Search` — pretraži po imenu/telefonu/emailu
- `POST /Customer/ByCustomerId` / `ByDate` / `ByDateRange`

**Fabric/Lining:**
- `POST /Fabric/FetchFabricStockInfo` / `Post` — stanje tkanina
- `POST /Lining/Post` — postave

**Autentikacija:** Svaki request traži `UserName` + `Password` + `AuthenticationToken`.
**✅ Token je dobijen** — kredencijali su u .env.local kao GOCREATE_USERNAME/PASSWORD/AUTH_TOKEN.

#### Tok kreiranja naloga u GoCreate (zašto nema API)
Kreiranje naloga nije jednostavna forma — prolazi kroz FitProfile sistem:
1. Izaberi/kreiraj klijenta
2. Otvori FitProfile tab → odaberi tip odjevnog predmeta (Shirt=8, Suit=1...)
3. Wizard: unesi mjere i fitting preferencije za taj tip
4. Odaberi tkaninu iz GoCreate kataloga (ima šifru npr. K10030)
5. Odaberi design opcije (GoCreate interni ID-ovi za kragnju, manžetnu itd.)
6. Nalog se kreira

Zbog ove kompleksnosti, automatizacija kreiranja naloga zahtijeva rebuild GoCreate klijenta unutar Millimeter app.

#### Plan integracije (realan, FINALAN)

| Šta | Moguće | Prioritet |
|---|---|---|
| Sync klijenata Millimeter → GoCreate via API | ✅ | #1 — radimo |
| Praćenje statusa Munro naloga u Millimeter app | ✅ | #2 — radimo |
| Nikola ručno kreira nalog u GoCreate | ✅ (status quo) | Ostaje zauvek |
| Automatizacija kreiranja naloga | ❌ | **Ne radimo** — `ProductPartId` su GoCreate interni ID-evi nedostupni bez njihove dokumentacije. API postoji ali nije iskoristiv. |

**SSID polje** pri Customer/Add: koristiti za čuvanje Millimeter customer ID-a → laka bidirekciona sinhronizacija.
**goCreateCustomerId** kolona treba biti dodata na `customers` tabelu u našoj bazi.

#### Realni format naloga
Order number format: `MILL.110.RS.XXXXXXX`
Account manager kod GoCreate-a: Marianne Cassou

#### GoCreate moduli (sve što postoji)
Orders, ReadyMade, FitProfile, Online Fitting Tool, Delivery Calendar, Fabric Stock (Suits/Shirts/Overcoats/Shoes/Ties/Pants/Knitwear/Vests/Lining/Label), RM Collection, Reports, Invoices, Payment transactions, Shop Settings

### Tok naloga
```
Draft → Potvrđen → U produkciji → Gotov → Isporučen
                                       ↑
                                  (Korekcije ←→ U produkciji)
```

---

## 11. Otvorena pitanja — čeka Nikolin odgovor

| Pitanje | Zašto je važno |
|---|---|
| URL i kredencijali Munro portala | Bez toga ne možemo uraditi integraciju |
| Kako tačno naručuje od Munra danas? | Email, telefon, portal? |
| Kolone u Nikolinom Excel klijenata | Da osoba koja formatira zna šta da pripremi |
| Da li su šabloni tačni? (Munro slim/Naš slim/Olimp) | Možda koriste drugačije nazive |
| Da li su manžetne tačne? (Jednostruka/Dupla/Francuska) | Možda nudi i druge tipove |
| Loyalty granice u RSD | Trenutno su pogrešne (postavljene u EUR vrijednostima) |
| Ko sve koristi sistem? | Treba kreirati korisničke naloge za osoblje |
| Da li žele PDF nalog za krojača? | Krojač i dalje nema digitalni dokument |

---

## 12. Poznati rizici (Pre-mortem analiza)

### 🔴 AKTIVAN BUG (2026-06-17)
`/inventory` vraća **504 GATEWAY_TIMEOUT — MIDDLEWARE_INVOCATION_TIMEOUT**.
Uzrok vjerovatno: middleware auth + Supabase cold start (Free tier) ILI inventory učitava svih 1.933 materijala + 92 artikla bez server-side paginacije pa middleware/funkcija timeoutuje.
**Treba istražiti:** middleware.ts (DB poziv?), inventory page.tsx (getMaterials/getInventoryItems bez limita?), Supabase status.
Povezano sa CRON_SECRET (nije postavljen → baza pauzira → cold start).

### 🐯 Tigeri — blokiraju upotrebu
1. **Supabase Free tier pauziranje** — app ne radi nakon 7 dana neaktivnosti
2. **Nema PDF naloga za krojača** — produkcija i dalje ide Viberom
3. **Nema korisničkih naloga za osoblje** — svi dijele admin nalog
4. **Loyalty tier granice su u EUR, ne RSD** — pogrešni tierovi za sve klijente
5. **Nikolin Excel možda ne odgovara template kolonama** — uvoz može propasti

### 📄 Paper Tigeri — nisu hitni
- Race condition na brojevima naloga (obim je premali da se desi)
- Nema RLS u Supabase (nema javnog API-ja, rizik je minimalan)
- Vercel Hobby plan limiti (daleko ispod granice)

### 🐘 Sloni — svi znaju, niko ne govori
- Nikola možda neće koristiti sistem bez onboardinga (jedan sat uživo ili Loom)
- Šabloni/mjere/manžetne su naše pretpostavke — nikad potvrđene
- Munro integracija: Nikola možda očekuje više od badge-a već sad

---

## 13. Faza 2 — Sljedeće (nije urađeno)

| Prioritet | Zadatak | Bilješka |
|---|---|---|
| 🔴 1 | **RLS na Supabase** | 23 CRITICAL greške u Supabase Advisoru — sve tabele bez RLS zaštite |
| 🔴 2 | Kreirati Nikolin korisnički nalog | Jedini nalog je admin@millimeter.me |
| 🔴 3 | PDF nalog za krojača | Krojač nema šta da dobije u ruke |
| 🔴 4 | CRON_SECRET na Vercel | Keepalive cron job ne radi bez ove env varijable |
| 🟠 5 | GoCreate integracija | Token dobijen ✅ — implementirati Customer/Add sync + status tracking |
| 🟠 6 | Uvoz klijentske baze | Čeka Nikolin formatiran Excel |
| 🟠 7 | Korisničke uloge (owner/radnik/krojač) | UI za dodavanje korisnika |
| 🟡 8 | Loyalty granice u RSD | Trenutno su u EUR vrijednostima — pogrešno |
| 🟡 9 | Onboarding za Nikolu | Loom video ili uživo sesija |

### RLS — kako implementirati (SQL za Supabase SQL Editor)
Supabase Dashboard → SQL Editor → pokrenuti za svaku tabelu:
```sql
-- Primjer za customers tabelu:
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation" ON customers
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));
```
Isti pattern za sve tabele: companies, users, customers, customer_measurements, orders, material_reservations, production_tasks, corrections, materials, inventory_items, inventory_movements, sales, sale_items, payments, loyalty_events, appointments, suppliers, supplier_invoices, supplier_invoice_items, invoice_additional_costs, audit_logs

---

## 14. Česte greške i rješenja

### ⚠️⚠️ `drizzle-kit push --force` BRIŠE SVE RLS (kritično!)
Push dropuje i ponovo pravi tabele → **briše sve RLS policy-je i isključuje RLS na SVIM tabelama**. Nakon SVAKOG push-a OBAVEZNO ponovo primijeniti `supabase/rls.sql` (ili MCP migraciju) i provjeriti:
```sql
SELECT (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true) AS rls_on,
       (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public') AS policies;  -- mora 23 i 23
```
Desilo se 2026-07-09 (dodavanje purchases/order_items) — uhvaćeno i vraćeno.

### `drizzle-kit push` visi na "Pulling schema from database..."
Koristiti session pooler (port 5432) sa `--force`, ne transaction pooler (6543):
```powershell
$env:DATABASE_URL="postgresql://postgres.zbmjhmvpavojahhnrkzp:<DB_LOZINKA>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"; npx drizzle-kit push --force
```

### Fajlovi sa `[id]` u putanji u PowerShell
Koristiti `-LiteralPath` umjesto normalnog patha (PowerShell tretira `[` kao wildcard):
```powershell
Get-Content -LiteralPath "path\[id]\file.tsx"
Set-Content -LiteralPath "path\[id]\file.tsx" -Value $content
```

### `prepare: false` je obavezno
Supabase PgBouncer transaction pooler ne podržava prepared statements. Podešeno u `src/lib/db/index.ts`.

### Vercel DATABASE_URL — obavezno `aws-1-eu-central-1`
Ne `aws-0-eu-central-1`. Pogrešan region = app ne može da se spoji na bazu.

---

## 15. Konvencije koda

- Sve stranice su `async` server components koji fetchuju podatke i proslijeđuju ih client komponentama
- Nikad fetching u client komponentama — sve ide kroz server actions
- Mutacije: `useTransition` + server action + `router.refresh()`
- Sve tabele imaju `companyId` guard u server actions (via `getCurrentUser()`)
- Valuta: RSD (ne EUR) — `RSD {iznos}` format
- Barkod format: `MM-MAT-XXXXXXXX` (materijali), `MM-INV-XXXXXXXX` (inventar)
- Excel uvoz: batch insert po 100 zapisa
- `importCustomers` provjerava duplikate po telefonu, `importMaterials` i `importInventoryItems` ne provjeravaju

---

---

## 16. Status na dan 2026-06-03 (handover između sesija)

### Sve Faza 1+2 stavke — ZAVRŠENO

| Stavka | Status |
|---|---|
| CRON_SECRET na Vercel | ✅ urađeno |
| Nikolin korisnički nalog | ✅ urađeno (nikola@millimeter.rs) |
| RLS na svim tabelama | ✅ potvrđeno SQL upitom — sve `rowsecurity = true` |
| PDF nalog za krojača | ✅ urađeno (commit bd71f65) |
| GoCreate Customer/Add sync | ✅ urađeno — novi klijenti se automatski kreiraju u GoCreate |
| GoCreate Munro nalozi u UI | ✅ urađeno — vidljivo na profilu klijenta |
| Loyalty granice u RSD | ⏳ čeka Nikolin odgovor — trenutno pogrešne (Silver 500, Gold 1500, Platinum 3000 su EUR vrednosti) |
| GitHub repo | ✅ postavljen na private |

### GoCreate integracija — detalji

`src/lib/gocreate.ts` — tri funkcije:
- `addGoCreateCustomer()` — kreira klijenta, polje `MobileNumber` (ne Phone!)
- `searchGoCreateCustomerByName()` — traži po `FirstName + LastName + PageSize`
- `getGoCreateOrders(goCreateCustomerId)` — vraća sve naloge, parametar `CustomerID` (bez ShopId)

Potvrđeni API parametri stvarnim pozivima:
| Endpoint | Ispravni parametri |
|---|---|
| `/Customer/Add` | `FirstName, LastName, MobileNumber, Email, SSID` |
| `/Customer/Search` | `FirstName, LastName, PageSize` |
| `/Order/ByCustomerId` | `CustomerID` (broj, bez ShopId) |

### GoCreate CreateOrder — zatvoreno

Kreiranje naloga automatski nije moguće. `ProductPartId` su GoCreate interni ID-evi nedostupni bez njihove dokumentacije. Nikola kreira naloge ručno u GoCreate — to ostaje status quo.

Nikola treba da pošalje supportu (Marianne):
> "Hi, I'm Nikola from Millimeter (Shop ID 2293). We're building an internal management system and would like to automate shirt order creation through the GoCreate API. Is this possible for partners, and if so, do you have API documentation for order creation? Who can we contact for technical support?"

### Šta čekamo od Nikole

- Excel sa bazom klijenata (osoba formatira 5 dana)
- Excel sa svim proizvodima i cenama
- Odgovor od GoCreate supporta oko CreateOrder
- Kolega koji preuzima komunikaciju sa developerom
- Loyalty granice u RSD

### Šta Nikola očekuje (iz njegove poruke Jun 2026)

- 6 korisničkih naloga (5 iz radnje + Nikola) — još nisu kreirani
- Produkcija mora da vidi i menja status naloga
- Munro: kada se nalog napravi, automatski se vidi šta je poručeno na profilu klijenta (ovo već radi za nove klijente)
- Loyalty i izveštaji nisu prioritet — "prvo ispeglati osnovu"

### Sledeći koraci po prioritetu

1. Sačekati Nikolin Excel → uvesti klijente i proizvode
2. Kreirati 5 korisničkih naloga za osoblje
3. Podesiti produkcijsku ulogu (krojači vide naloge, menjaju status)
4. Loyalty granice u RSD (čeka Nikolu)

### Kako početi novu sesiju
1. Ovaj fajl se učitava automatski
2. Pročitaj `.env.local` za kredencijale
3. Koristi promptove iz `C:\Users\acer\.claude\prompts\` pre kodiranja

---

## 17. Update 2026-06-17

- **🔴 NOVI BUG:** `/inventory` → 504 GATEWAY_TIMEOUT (MIDDLEWARE_INVOCATION_TIMEOUT). Vidi sekciju 12. Prioritet za popravku.
- **Excel klijenata:** Nikola poslao `primerak spiska.xlsx` (6/4). Dogovoren format: samo **Ime, Prezime, Telefon** (jedan klijent po redu). Čeka se kompletan spisak.
- **Munro CreateOrder:** definitivno zatvoreno — ne šalju se više pitanja supportu. Finalno rješenje (klijent sync + status na profilu) potvrđeno sa Nikolom kao dovoljno.
- **🔴 Supabase je BIO PAUZIRAN (root cause 504).** Resume urađen ručno. Keepalive preko Vercel cron NIJE radio. RIJEŠENO: GitHub Actions keepalive (`.github/workflows/keepalive.yml`) pinguje Supabase REST svaki dan — testiran, radi.
- **✅ GoCreate integracija testirana end-to-end (17.6):** novi klijent iz app → stvarno se kreira u GoCreate (potvrđeno u njihovom webu), nalozi se prikazuju na profilu klijenta (vizuelno potvrđeno), deep-link dugme ka GoCreate radi. Token uživo radi.
- **🟠 TODO — GoCreate search po telefonu:** `searchGoCreateCustomerByName` traži po imenu. Nikola kaže da ima brdo klijenata sa istim imenima → prebaciti na pretragu po telefonu (GoCreate Customer/Search podržava `MobileNumber` polje). Bitno za sync postojećih klijenata kod uvoza Excel baze.
- **Uvoz klijenata:** referenca = TELEFON (dedup po telefonu, `importCustomers` već radi tako). Svaki klijent MORA imati Ime+Prezime+Telefon, inače se preskače (customers.ts:323).

---

## 18. Poslovni dogovor i komunikacija sa klijentom (iz WhatsApp prepiske)

### Dogovor
- **Cijena razvoja: 350€** (drugarska — Nikola je Stojanov prijatelj). Uslov: preporuka dalje ako bude zadovoljan. Ako saradnja ne ide dobro → naplata samo investiranog vremena do tada.
- **AI operativni troškovi: ~100–150€** do kraja projekta (30€ već pokriveno). Nikola pristao da pokrije, Matej prilaže račune.
- **Uplata ide na:** Matej Nević, Erste banka, 340 0001000287094 03
- **Supabase $25/mj + domena ~12€/god** — Nikola JE OBAVIJEŠTEN i prihvatio (operativni trošak na njegovoj strani kad app krene u upotrebu). NE ponavljati mu to.

### Kako Millimeter trenutno radi (Nikolinim riječima)
- Nalozi: Excel tabele
- Mjere klijenata: fizički se čuvaju pod imenom (broj bolje zbog ponavljanja imena)
- Munro: ino dobavljač, web sistem (gocreate.nu), plaćaju karticom
- Kasa: **Fusion Octopos** — integracija nije u skopu (kompleksno zbog poreske regulative)

### Korisničke uloge — tačna specifikacija (Nikola)
- **Vlasnici** (Nikola + Miloš): pun pristup + izvještaji
- **Zaposleni u radnji** (5 osoba): pristup nalozima i klijentima
- **Produkcija** (1 osoba, krojač): pristup SAMO svojoj listi naloga, mijenja status, bez ostatka sistema
- Svako se prijavljuje svojim nalogom
- Naloge za proizvodnju prave samo ljudi iz radnje (5 + Nikola = 6)

### ⚠️ Forma za nalog — VAŽNA dorada koju Nikola traži
Forma mjera treba **korekcije +/- cm po svakoj mjeri u odnosu na odabrani šablon** (ne samo apsolutne vrijednosti). Mjere: vrat, grudi, struk, stomak, kukovi, dužina, aksla, leđa, rukav, biceps, podlaktica, zglob. **Provjeriti da li trenutna forma ovo podržava — vjerovatno NE.**

### Šta Nikola još šalje
- Excel baza klijenata (kompletan spisak — format: Ime, Prezime, Telefon)
- Excel sve proizvode i materijale sa cijenama (uvoz dodatnih artikala pored 92 Munro odijela)

### Status saradnje (Nikolinim riječima, jun 2026)
"Postavka je dobra, ali ima mnogo da se dorađuje. Daleko je od završenog — tek treba da prođemo kroz to i skrenemo pažnju šta da se uradi drugačije." → Faza 1 je SKELET, slijedi iteracija na detaljima.

### ⚡ SPRINT — Aleksandar preuzeo (jul 2026)
- **Kontakt je sada Aleksandar** (kolega), dok je Nikola na odmoru. Prešli na "ti".
- **Rok: ~15 dana da se završi cijela aplikacija.**
- Aleksandar danima testira app, poslao **prvi izveštaj** (feedback sa promjenama — čeka se da stigne Mateju mejlom). Radimo iterativno po njegovim primjedbama: funkcije, dizajn, sve što kaže.
- **Word dokument** (originalna specifikacija) — Matej ga već ima, to je bila polazna tačka projekta.
- **Klijenti:** Aleksandar ima spisak na Google Drive spreadsheetu. Šalje Ime/Prezime/Telefon (jedinstveni, jedan po redu, dedup po telefonu). Istorija kupovina = drugi korak (via `addHistoricalPurchase`, treba kolone: datum/artikal/iznos).

### Stil komunikacije sa klijentom (kako Matej piše Nikoli)
- **Ekavica, "ti" forma — BEZ persiranja.** (Matej i Nikola su prešli na ti.) Interna komunikacija sa Matejem je jekavica.
- **BEZ AI tona:** bez crtica (—), bez bullet lista, bez "evo kako/evo plana". Prirodan, tečan tekst kao da kuca prijatelju.
- Kratko, direktno, opušteno. Matejeve fraze: "Ćao", "Vazi", "u principu", "skroz", "kod nas / kod njih".
- Bez tehničkog žargona — objasni ljudski.
- Pred slanje bilo koje poruke klijentu: provjeriti sa Matejem prije.

---

## 19. Status 2026-06-19 — gdje smo i šta je ostalo

### ✅ Gotovo
- Faza 1 kompletna (CRM, nalozi, produkcija, zalihe, barkodovi, uvoz 1933 materijala + 92 artikla)
- PDF nalog za krojača
- GoCreate integracija — testirana end-to-end (klijent sync + nalozi na profilu + deep link)
- RLS na svih 21 tabeli, GitHub Actions keepalive, infrastruktura očišćena (nema duplih), MCP pristup sa Matejevog naloga radi

### 🔨 Ostalo da se radi (sigurno, ne čeka nikog)
1. **Korisničke uloge** — vlasnik / radnja / produkcija. Produkcija vidi SAMO svoju listu naloga + mijenja status, bez ostatka sistema. (Vidi sekciju 18 za tačnu specifikaciju.) Trenutno postoji samo admin + nikola nalog. **Najveći prioritet, temelj za ostalo.**
2. **+/- cm korekcije mjera** na formi naloga, u odnosu na šablon. (Vidi sekciju 18 — vjerovatno NIJE implementirano, provjeriti formu.)
3. **GoCreate search po telefonu** umjesto po imenu (sekcija 17).

### ⏳ Čeka Nikolu (ne možemo bez njega)
4. Excel baza klijenata (kompletan spisak) → uvoz
5. Excel proizvoda sa cijenama → uvoz
6. Feedback od kolege (preuzima komunikaciju, prolazi kroz app, šalje spisak dorada)

### 🚫 Nije prioritet (Nikola: "fokus na osnovi")
Loyalty granice (trenutno EUR vrijednosti, pogrešno), izvještaji, mobilna verzija — kasnije.

### Sljedeća sesija — počni od
Korisničke uloge (tačka 1). Ili korekcije mjera (tačka 2) ako se hoće brza vidljiva stvar.

---

## 20. Sigurnosni pregled 2026-07-02 (nalazi — NIŠTA još nije popravljeno)

Urađen temeljit security scan celog koda. Ranije po ozbiljnosti:

### 🔴 Kritično
1. **GitHub repo je JAVAN** (`github.com/millimeterapp-afk/millimeter-app` → 200). Prave tajne su bezbjedne (`.env.local` u gitignore, provjereno — nema DB lozinke/service key/tokena u repou). ALI:
2. **Nikolina prava lozinka je hardkodirana kao placeholder u kodu** — `settings-client.tsx:177` (`placeholder="npr. <Nikolina login lozinka>"`). Ista lozinka koju koristi `nikola@millimeter.rs`. Fix: repo→Private + promijeni placeholder u generički + promijeni Nikolinu lozinku (bila izložena u javnom repou).

### 🟠 Visoko
3. **Nema clickjacking zaštite** — `next.config.ts` prazan, fale `X-Frame-Options`/CSP (HSTS Vercel dodaje sam). Fix: `headers()` u next.config.
4. **Lozinka kao plain text** — `settings-client.tsx:175` polje nije `type="password"`.

### 🟡 Srednje
5. **Race condition na broju naloga** — `orders.ts:59` `generateOrderNumber` koristi `count(*)` → dupli NAL-broj pri istovremenom radu. Fix: PostgreSQL SEQUENCE.
6. **createOrder ne provjerava da customerId pripada firmi** — `orders.ts:70`. Fix: provjera prije insert-a.
7. **Vercel keepalive ruta mrtva** — middleware matcher je redirektuje na /login. Nebitno (GitHub Actions keepalive radi nezavisno), ali mrtav kod.

### 🟢 Provjereno OK
Nema SQL injekcije (sve parametrizovano). Svaka akcija ima companyId guard. createAdminClient owner-gated. RLS na 21 tabeli. .env.local nije u gitu.

### Build-better / UX predlozi (za kasnije)
- getCurrentUser() dupliran u 8 fajlova → izvući u lib/auth.ts
- Inventory učitava svih 1933 reda odjednom → server-side paginacija
- Login: dodati toggle prikaz lozinke; forma naloga: progress + draft; prazna stanja: dugme "dodaj prvog"

---

## 21. ⭐ STVARNI POSLOVNI MODEL (Aleksandar, jul 2026) — NAJVAŽNIJE

Aleksandar (detaljni mejlovi) otkrio da **trenutni model aplikacije NE odgovara stvarnosti**. Ovo je referentna specifikacija za core rework.

### Struktura: PORUDŽBINA → NALOZI → STAVKE (troslojno)
Trenutna app: jedan nalog = jedna stavka. **POGREŠNO.** Stvarnost:
```
PORUDŽBINA (jedna po dolasku klijenta, npr. "oblačenje za svadbu")
├── NALOG (Munro)            → dvodelno odelo | rok 4-6 nedelja (Munro određuje)
├── NALOG (domaća proizvodnja) → 2-7 košulja u JEDNOM nalogu | rok 10-15 radnih dana
├── STAVKA (gotov proizvod)  → cipele Doucals (nema proizvodnje, samo prodaja)
└── STAVKA (gotov proizvod)  → kravata
```
- Jedna porudžbina = više naloga, jedan nalog domaće proizvodnje = više stavki (npr. 7 košulja).
- Različiti tipovi imaju različit tok i rok.

### Tri tipa artikla (kolona koja se sada zove "Vrsta materijala" = zapravo "Artikal")
1. **Domaća proizvodnja** — materijal na stanju ili se naruči, uzmu mere → nalog ka NAŠOJ proizvodnji. Rok 10-15 radnih dana.
2. **Munro** — uzmu mere, naprave nalog → komad stiže napravljen iz Munro fabrike. Može: dvodelno odelo, pantalone, sako, košulja, prsluk, knit, obuća, aksesoar. Rok 4-6 nedelja.
3. **Gotov proizvod / usluga** — partneri: Gran Sasso (majice, patike, prsluci), Falke (čarape, majice), Doucals (obuća); nepokupljeni Munro artikli; aksesoari (kravate, maramice, dugmad).
Svi artikli postoje u kasi (Fusion Octopos) — opcije povlačiti iz kase ILI Aleksandar dokumentuje kad dođe vrijeme za module.

### Avans / plaćanje (app PRATI, ne mijenja kasu)
- Pri naručivanju: klijent plaća ~50% ukupne sume svega naručenog. Kuca se kroz kasu kao **Avans** (ne kao artikal).
- Pri preuzimanju (nakon korekcija): plaća ostatak do punog iznosa → fiskalni račun.
- Varijante: pun iznos odmah (avans na pun, fiskalni sa doplatom 0); plaćanje iz više puta (avansi se **ulančavaju** — prvi pri naručivanju, drugi na probi, ostatak pri preuzimanju).
- **Fiskalizacija/kasa OSTAJU kod njih** (van skopa). App samo prati iznose: avans, ostatak, ko koliko duguje.

### Tok statusa (domaća proizvodnja košulje — Aleksandarov predlog, nazivi TBD)
1. **Naručeno** — klijent bira materijal u radnji
2. **Čeka se materijal** (opciono) — ako nema na stanju, naručuje se od partnera
3. **Napraviti nalog** (međukorak) — sprječava da se nalog zaboravi dok se ne pošalje proizvodnji
4. **Izrada** — nalog u proizvodnji
5. **Gotova košulja** — signal radnji da je gotova
6. **U radnji** — stigla u radnju (svih 5 u radnji vide status bez zvanja proizvodnje)
7. Proba: **Preuzeta košulja** (ok) ILI **Korekcija** (nazad u proizvodnju → petlja na korak Izrada)
**Zašto je ovo srce app-a:** jun = ~200 košulja, 5 ljudi u radnji, niko ne zna dokle je šta → stalno zvanje proizvodnje. Jasan status svima = glavna vrijednost.
Aleksandar šalje isti ovakav tok za Munro i gotov proizvod (čeka se).

### Šta ovo znači za razvoj — CORE REWORK
Model naloga se mora preraditi: **nova hijerarhija porudžbina→nalozi→stavke + bogatiji status enum po tipu naloga.** Ovo je glavni posao sprinta, ne "korisničke uloge". Schema promjena (nova parent tabela porudžbine, stavke kao djeca naloga, statusi po tipu).

---

## 22. Faza 2+3 — Novi model IMPLEMENTIRAN (2026-07-12)

### ✅ Schema (Faza 2)
- `purchases` (porudžbina, parent) + `order_items` (stavke, djeca naloga) dodate.
- `orders` dobio `purchaseId`, `orderKind` (enum `domaca|munro|gotov`), `nalogStatus` (enum: naruceno, ceka_materijal, za_izradu, izrada, gotovo, u_radnji, preuzeto, korekcija, otkazano).
- Sekvence `purchase_number_seq` / `nalog_number_seq` (atomarno, bez race-a). Brojevi: `POR-YYYY-####`, `NAL-YYYY-####`.
- RLS potvrđen: orders/purchases/order_items imaju `company_isolation` (order_items kroz EXISTS na orders). Provjereno 2026-07-12.

### ✅ Server actions — `src/lib/actions/purchases.ts`
`createPurchase` (validacija server-side, provjera da klijent pripada firmi, avans kao uplata, Munro sync), `getPurchases`, `getPurchase`, `getNalozi` (lista, sa customer+items+purchase), `getNaloziForProduction` (aktivni, bez preuzeto/otkazano), `updateNalogStatus`, `addPurchasePayment` (naplata na nivou porudžbine).

### ✅ UI (Faza 3) — sve prebačeno na novi model, build zelen
- **Novi nalog** (`/orders/new`): wizard Klijent → Nalozi (3 tipa, više stavki, krojački detalji) → Avans (50% shortcut).
- **Lista naloga** (`/orders`): kolone Tip (orderKind) + Status (nalogStatus), artikli iz stavki, tabovi po fazi + Kasni/Neplaćeni.
- **Detalj naloga** (`/orders/[id]`): kartica "Stavke naloga", kontrola "Faza izrade" (nalogStatus), naplata svjesna porudžbine (avans pokriva sve naloge). Stari lifecycle stepper i dalje vidljiv (pogoni rezervaciju materijala + statistiku klijenta).
- **Produkcija** (`/production`): Kanban po `nalogStatus` (6 kolona + korekcija strip), pomjeranje kroz faze `updateNalogStatus`.
- **Dashboard / Reports / Profil klijenta**: KPI i istorija na `nalogStatus`/`orderKind`; naplaćeno dedup po porudžbini.

### ⚠️ Poznati follow-up (Faza 2.5 — poslovna logika, ne UI)
**Dva statusna sistema koegzistiraju.** Stari `orders.status` (draft→delivered) pogoni rezervaciju materijala i `customer.totalSpent`/loyalty na "delivered". Novi `nalogStatus` je operativni traker koji radnici koriste. Za nove naloge (kroz `createPurchase`) radnici koriste **Faza izrade** (nalogStatus) → pa se `totalSpent`/loyalty i rezervacija materijala NE okidaju automatski na "preuzeto".
- **Treba:** okinuti statistiku klijenta + materijal iz `updateNalogStatus` kad nalog ide u "preuzeto" (pažljivo: porudžbina ima više naloga — ne duplirati visitCount; novac ide iz `purchase.paidAmount`).
- **Blokira:** čeka Aleksandra da potvrdi tačne nazive/tok statusa za Munro i gotov proizvod (nazivi nalogStatus su naš predlog, TBD). Tek onda finalizovati pravila status→novac.

---

*CLAUDE.md ažuriran: 2026-07-12*
