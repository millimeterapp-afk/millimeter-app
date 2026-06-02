# Millimeter App — CLAUDE.md

model: claude-sonnet-4-6

Interni poslovni sistem za krojačku firmu (CRM + nalozi + produkcija + zalihe + prodaja). Sav UI tekst je na srpskom jeziku. **Uvek komuniciraj isključivo na srpskom jeziku — ekavica (ne ijekavica). Primer: "razumem", "primer", "sledeći", "ovde", "vreme" — nikad "razumijem", "primjer", "sljedeći", "ovdje", "vrijeme".**

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

## 16. Status na dan 2026-06-02 (handover između sesija)

### Šta je urađeno
- GoCreate API token primljen ✅ (u .env.local)
- Keepalive cron job commitovan ✅ (ali CRON_SECRET nije na Vercelu)
- RLS SQL fajl napravljen i commitovan ✅ (`supabase/rls.sql`)
- Ekavica + token optimizacija dodati u CLAUDE.md ✅

### GoCreate CreateOrder API — istraživanje (Jun 2026)

**VAŽNO: API za kreiranje naloga POSTOJI** — `POST /Order/CreateOrder` funkcioniše.

#### Potvrđena struktura payloada:
```json
{
  "UserName": "MILL_API",
  "Password": "...",
  "AuthenticationToken": "...",
  "input": {},
  "OrderData": {
    "ShopId": 2293,
    "CustomerID": 520011,
    "Item": { "Id": 8, "Name": "Shirt" },
    "Fabric": { "Id": 14, "Name": "SH00014 white cotton twill" },
    "Status": "Processed",
    "Occasion": "Everyday",
    "ShopOrderNumber": "MILL-XXX",
    "ProductData": [
      {
        "StyleOrderNumber": "TEST-STYLE-001",
        "BrandingOptionData": [],
        "FitAndTryOnData": {
          "FitProfileName": "Slim Fit",
          "FitToolData": [
            { "Id": 1, "Name": "Neck", "Value": 39 },
            { "Id": 2, "Name": "Chest", "Value": 100 }
          ]
        }
      }
    ]
  }
}
```

#### Šta je rešeno:
- `input: {}` ✅ — prazan objekat prolazi validaciju
- `Fabric` mora biti `{ Id, Name }` ✅
- `Item` mora biti `{ Id, Name }` ✅ (Shirt = Id 8)
- `BrandingOptionData` mora biti niz `[]` ✅
- `FitToolData` mora biti `List<IDNameAndValue>` = `[{ Id, Name, Value }]` ✅

#### Preostali problem:
`"Product part id : 0 is invalid"` — `ProductData[0]` nema pravi GoCreate ID.
Sledeći korak: t18 dohvata pravi nalog (`MILL.110.RS.0000034`) da vidimo tačnu strukturu ProductData iz stvarnog naloga.

#### Test endpoint (privremeni, obrisati nakon istraživanja):
`https://millimeter-app-lyart.vercel.app/api/test-create?secret=gc-debug-2026`
Fajl: `src/app/api/test-create/route.ts`

### Šta nije urađeno
- **CRON_SECRET na Vercel:** NE — dodati ručno (Settings → Env Vars → `CRON_SECRET=millimeter-keepalive-2026`)
- **RLS:** SQL fajl postoji (`supabase/rls.sql`) ali nije pokrenut u Supabase
- **GoCreate CreateOrder:** Struktura skoro rešena, čeka se odgovor t18 (pravi nalog)
- **Nikolin korisnički nalog:** Nije kreiran
- **PDF nalog za krojača:** Nije urađen

### Sledeći koraci po prioritetu
1. **Implementirati Customer/Add sync** — Millimeter klijent → GoCreate (API je jasan, radi)
2. **Implementirati status tracking** — čitanje Munro naloga koje Nikola ručno kreira u GoCreate
3. Pokrenuti `supabase/rls.sql` u Supabase SQL Editoru
4. Dodati `CRON_SECRET` na Vercel
5. Kreirati Nikolin korisnički nalog
6. PDF nalog za krojača

### Kako početi novu sesiju
1. Ovaj fajl se učitava automatski
2. Pročitaj `.env.local` za kredencijale
3. Kreni od Prioriteta 1 gore

---

*CLAUDE.md ažuriran: 2026-06-02*
