# Millimeter App — CLAUDE.md

Interni poslovni sistem za krojačku firmu (CRM + nalozi + produkcija + zalihe + prodaja). Sav UI tekst je na srpskom jeziku. **Uvijek komuniciraj isključivo na srpskom jeziku.**

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

## 2. Infrastruktura

**Supabase projekat:** `zbmjhmvpavojahhnrkzp`
**Region:** `eu-central-1` (Frankfurt)
**Dashboard:** https://supabase.com/dashboard/project/zbmjhmvpavojahhnrkzp
**GitHub repo:** https://github.com/millimeterapp-afk/millimeter-app (Public)
**Vercel deploy:** https://millimeter-app.vercel.app (projekt pod millimeterapp-afk nalogom)

### `.env.local` (nikad commitovati — u .gitignore)
```
NEXT_PUBLIC_SUPABASE_URL=https://zbmjhmvpavojahhnrkzp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key iz Supabase projekta>
SUPABASE_SERVICE_ROLE_KEY=<service role key iz Supabase projekta>
DATABASE_URL=postgresql://postgres.zbmjhmvpavojahhnrkzp:<password>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
```

**DB konekcija:** PgBouncer transaction pooler (port 6543), `prepare: false`
**Za migracije** koristiti session pooler (port 5432) ili direktnu konekciju.

### Admin nalog
- **Email:** admin@millimeter.me
- **Lozinka:** admin123
- **companyId:** e44571bb-e3e9-4a11-8ea4-70cb69b0960d
- **Role:** owner

---

## 3. Pokretanje projekta

```bash
# Instalacija
npm install

# Dev server
npm run dev
# → http://localhost:3000

# Migracija baze (po promjeni schema.ts) — session pooler port 5432
$env:DATABASE_URL="postgresql://postgres.zbmjhmvpavojahhnrkzp:<password>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"; npx drizzle-kit push --force

# Build provjera
npx next build
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
| `companies` | Firme (CG, Španija...) | name, country, currency |
| `users` | Korisnici (id = Supabase Auth UUID) | email, fullName, role, companyId |
| `customers` | Klijenti firme | firstName, lastName, phone, templateNumber, loyaltyTier, totalSpent |
| `customer_measurements` | Merenja klijenta (JSONB) | customerId, label, data{vrat,grudi,struk...} |
| `orders` | Svi nalozi | orderNumber, customerId, status, dueDate, totalAmount, paidAmount, paymentStatus, **productionFlow** |
| `orders` (custom fields) | Denormalizovano za nalog po mjeri | item, material, templateNumber, collarType, cuffType, fitType, measurementSnapshot, monogramData |
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
- `importMaterials(formData)` — uvozi materijale iz Excel-a (Naziv, Šifra, Barkod, Grupa, JM, Nab. cena sa PDV)
- `importInventoryItems(formData)` — uvozi gotovu robu iz Excel-a (Naziv, Šifra, Grupa, Cena)

### Ostali actions (neizmijenjeni)
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
| `/dashboard` | Glavni dashboard sa KPI karticama, grafikonom, terminima danas | ✅ |
| `/customers` | Lista klijenata (Template + Uvezi Excel dugmad) | ✅ |
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

Svih 5 zadataka iz Faze 1 su implementirani:

### ✅ Zadatak 1 — Dva toka produkcije
- `productionFlow` kolona na `orders` tabeli (default: "millimeter")
- Toggle "Millimeter" / "Munro" u Step 1 (Detalji) wizarda
- Munro badge (ljubičast) na listi naloga
- Munro nalozi ne idu na produkcijski board

### ✅ Zadatak 2 — Proširena forma za nalog košulje
Wizard sada ima 5 koraka (Klijent → Detalji → Mjerenja → Materijal → Potvrda):
- **Šablon + veličina:** Munro slim (38–45), Naš slim (38–44), Olimp (S–XXXL)
- **Manžetna (cuffType):** Jednostruka / Dupla / Francuska
- **Inicijali/monogram:** Checkbox + pozicija (Štej/Manžetna/Prednjica) + boja + font (Pisano/Štampano ćirilica/Pisano latinica/Štampano latinica)
- **13 mjerenja (cm):** vrat, grudi, struk, stomak, kukovi, dužina naprijed/pozadi, aksla, leđa, rukav, biceps, podlaktica, zglob
- `fitType` se čuva kao "šablon / veličina", monogram u `measurementSnapshot`

### ✅ Zadatak 3 — Uvoz 1.933 materijala
- Dugme "Uvezi Excel" na Materials tabu u `/inventory`
- Server akcija `importMaterials(formData)` mapira: Naziv→name, Šifra→code, Barkod→barcode, Grupa→category, JM→unit, "Nab. cena sa PDV"→lastPurchasePrice
- Batch insert po 100, vraća {inserted, total}

### ✅ Zadatak 4 — Uvoz 92 Munro artikla
- Dugme "Uvezi Excel" na Gotova roba tabu u `/inventory`
- Server akcija `importInventoryItems(formData)` mapira: Naziv→name, Šifra→sku, Grupa→category, Cena→salePrice
- Isti pattern kao materijali

### ✅ Zadatak 5 — Template za uvoz klijenata
- Dugme "Template" → download Excel template sa kolonama: Ime, Prezime, Telefon, Email, Adresa, Grad, Broj šablona, Napomena
- Dugme "Uvezi Excel" → server akcija `importCustomers(formData)`, preskače duplikate po telefonu
- Modal sa rezultatom uvoza (uvezeno X, preskočeno Y)

---

## 9. Deploy

**Status:** Deployed na Vercel

- **GitHub:** `millimeterapp-afk/millimeter-app` (nalog vlasnika Nikole)
- **Vercel:** Projekt pod `millimeterapp-afk` Vercel nalogom
- **Live URL:** https://millimeter-app.vercel.app

### Vercel env varijable (obavezno)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL  ← koristiti aws-1-eu-central-1 (ne aws-0-)
```

### Supabase Auth podešavanja
- Site URL: https://millimeter-app.vercel.app
- Redirect URLs: https://millimeter-app.vercel.app/auth/callback

---

## 10. Česte greške i rješenja

### `drizzle-kit push` visi na "Pulling schema from database..."
Koristiti session pooler (port 5432) sa `--force` flagom, ne transaction pooler (port 6543):
```powershell
$env:DATABASE_URL="postgresql://postgres.zbmjhmvpavojahhnrkzp:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"; npx drizzle-kit push --force
```

### `DATABASE_URL is not defined` kod drizzle-kit
Varijabla mora biti u istom PowerShell pozivu (`;` između, ne novi red).

### `prepare: false` je obavezno
Supabase PgBouncer transaction pooler ne podržava prepared statements. Podešeno u `src/lib/db/index.ts`.

### EMAXCONN — previše konekcija
Singleton pattern u `src/lib/db/index.ts` sprječava ovo u dev modu.

---

## 11. Konvencije koda

- Sve stranice su `async` server components koji fetchuju podatke i proslijeđuju ih client komponentama
- Nikad fetching u client komponentama — sve ide kroz server actions
- Mutacije: `useTransition` + server action + `router.refresh()`
- Sve tabele imaju `companyId` guard u server actions (via `getCurrentUser()`)
- Barkod format: `MM-MAT-XXXXXXXX` (materijali), `MM-INV-XXXXXXXX` (inventar)
- Loyalty tier: Bronze (<500€), Silver (500–1499€), Gold (1500–2999€), Platinum (3000€+)
- Excel uvoz: batch insert po 100 zapisa, `importMaterials` i `importInventoryItems` ne provjeravaju duplikate, `importCustomers` provjerava duplikate po telefonu

---

## 12. Poslovni kontekst

Firma: **MIN CLOTHING DOO (Millimeter)** — premium krojačnica.
- **Nikola Miljković** — 50% vlasnik, primarni kontakt (millimeterapp@gmail.com)
- **Miloš Ivanović** — 50% vlasnik
- Prihod 2025: ~€850.000, ~10 zaposlenih
- Lokacija: Beograd (Omladinskih brigada 86g)
- Košulje: od 12.990 RSD | Odijela: 77.490–97.990 RSD

### Munro
Odvojena firma/partner kojoj se šalju neki nalozi. Munro nalozi se vode u sistemu ali ne idu na produkcijski board. Komunikacija trenutno ide emailom/Viberom.

### Tok naloga
```
Draft → Potvrđen → U produkciji → Gotov → Isporučen
                                       ↑
                                  (Korekcije ←→ U produkciji)
```

---

*CLAUDE.md ažuriran: 2026-05-20*
