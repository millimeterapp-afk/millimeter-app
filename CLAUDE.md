# Millimeter App — CLAUDE.md

Interni poslovni sistem za krojačku firmu (CRM + nalozi + produkcija + zalihe + prodaja). Sav UI tekst je na srpskom jeziku. **Uvijek komuniciraj isključivo na srpskom jeziku.**

---

## 1. Tech Stack

| Sloj | Tehnologija | Napomena |
|---|---|---|
| Framework | Next.js 16 (App Router) | `src/` folder, server components po defaultu |
| Language | TypeScript 5 | Strict mode |
| Styling | Tailwind CSS 4 + shadcn/ui | Komponente u `src/components/ui/` |
| Database | PostgreSQL via Supabase | Managed cloud instance |
| ORM | Drizzle ORM | Schema u `src/lib/db/schema.ts` |
| Auth | Supabase Auth | SSR setup sa `@supabase/ssr` |
| Charts | Recharts 3 | Na dashboard i reports stranicama |
| Barcodes | react-barcode | Code128 format, print via JSBarcode CDN |
| Icons | Lucide React | |
| State | React `useState` / `useTransition` | Nema Zustand — jednostavan scope |

---

## 2. Infrastruktura i kredencijali

**Supabase projekat:** `xejjwvsnnlmwrwcxeyki`
**Region:** `aws-1-eu-west-2` (London)
**Dashboard:** https://supabase.com/dashboard/project/xejjwvsnnlmwrwcxeyki

### `.env.local` (nikad commitovati)
```
NEXT_PUBLIC_SUPABASE_URL=https://xejjwvsnnlmwrwcxeyki.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres.xejjwvsnnlmwrwcxeyki:matejcinaija123456@aws-1-eu-west-2.pooler.supabase.com:6543/postgres
```

**DB konekcija:** PgBouncer transaction pooler (port 6543), `prepare: false`, max 3 konekcije.

### Admin nalog
- **Email:** admin@millimeter.me
- **Lozinka:** Admin123456!
- **Role:** owner (pristup svim firmama, svim modulima)

---

## 3. Pokretanje projekta

```bash
# Instalacija
cd C:\Users\acer\Desktop\millimeter-app
npm install

# Dev server
npm run dev
# → http://localhost:3000

# Migracija baze (po promjeni schema.ts)
$env:DATABASE_URL="postgresql://postgres.xejjwvsnnlmwrwcxeyki:matejcinaija123456@aws-1-eu-west-2.pooler.supabase.com:6543/postgres"; npx drizzle-kit push

# Drizzle Studio (pregled baze)
npm run db:studio

# Build provjera (umjesto tsc --noEmit koji instalira pogrešan paket)
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
| `customers` | Klijenti firme | firstName, lastName, phone, templateNumber, loyaltyPoints, loyaltyTier, totalSpent |
| `customer_measurements` | Merenja klijenta (JSONB) | customerId, label, data{vrat,grudi,struk...} |
| `orders` | Svi nalozi | orderNumber, customerId, status, dueDate, totalAmount, paidAmount, paymentStatus |
| `orders` (custom fields) | Denormalizovano za nalog po mjeri | item, material, templateNumber, collarType, sleeveType, fitType, measurementSnapshot |
| `material_reservations` | Rezervacije materijala po nalogu | orderId, materialId, quantityReserved, status{reserved/consumed/released} |
| `production_tasks` | Produkcijski zadaci | orderId, assignedTo, priority, status, dueDate |
| `corrections` | Korekcije/izmjene | orderId, customerId, correctionType, description, status, affectsTemplate |
| `materials` | Materijali (tkanine, dugmad...) | name, code, barcode, unit, currentStock, reservedStock, reorderLevel, lastPurchasePrice |
| `inventory_items` | Gotova roba | name, sku, barcode, quantity, reservedQuantity, salePrice, costPrice |
| `inventory_movements` | Kretanja zaliha (log) | itemType, itemId, movementType, quantity |
| `sales` | Prodajni dokumenti | saleNumber, customerId, paymentMethod, totalAmount |
| `sale_items` | Stavke prodaje | saleId, itemName, inventoryItemId, quantity, unitPrice |
| `payments` | Uplate (za naloge i prodaju) | referenceType, referenceId, amount, paymentDate |
| `loyalty_events` | Loyalty transakcije | customerId, eventType{earn/redeem/adjust}, points |
| `appointments` | Zakazani termini | customerId, scheduledAt, durationMinutes, type, status |
| `suppliers` | Dobavljači | name, contactPerson, email, phone, country |
| `supplier_invoices` | Ulazne fakture | supplierId, invoiceNumber, currency, subtotal, totalAdditionalCosts, totalAmount, status{draft/verified/posted} |
| `supplier_invoice_items` | Stavke fakture | invoiceId, materialId/inventoryItemId, quantity, unitPrice, allocatedAdditionalCost, finalUnitCost |
| `invoice_additional_costs` | Troškovi na fakturu | invoiceId, costType{transport/customs_duty/customs_fee/other}, amount, customsDutyRate |
| `audit_logs` | Revizija svih promjena | userId, action, entityType, entityId, oldValues, newValues |

---

## 6. Server Actions — sve funkcije

### `src/lib/actions/customers.ts`
- `getCustomers()` — lista svih klijenata kompanije
- `getCustomer(id)` — profil sa merenjima, narudžbinama, korekcijama
- `createCustomer(data)` — novi klijent
- `updateCustomer(id, data)` — izmjena klijenta
- `addMeasurement(customerId, label, data)` — dodaj merenja
- `updateLoyaltyPoints(customerId, points, eventType)` — loyalty operacija

### `src/lib/actions/orders.ts`
- `getOrders()` — lista svih naloga sa customer join
- `getOrder(id)` — detalji sa customer, tasks, corrections
- `createOrder(data)` — novi nalog, auto-generiše orderNumber
- `updateOrderStatus(id, status)` — promjena statusa
- `updatePayment(id, amount, method)` — uplata na nalog
- `sendToProduction(id, data)` — kreira production_task, mijenja status u in_production
- `deliverOrder(id)` — isporuka, ažurira customer.totalSpent, loyalty poene
- `cancelOrder(id)` — otkazivanje, oslobađa rezervacije

### `src/lib/actions/production.ts`
- `getProductionTasks()` — sve zadatke sa order join
- `updateTaskStatus(id, status)` — promjena statusa zadatka
- `addProductionNote(id, note)` — bilješka produkcije

### `src/lib/actions/corrections.ts`
- `getCorrections()` — lista korekcija sa customer, order join
- `createCorrection(data)` — nova korekcija
- `updateCorrectionStatus(id, status)` — promjena statusa
- `sendCorrectionToProduction(id, dueDate)` — kreira production_task za korekciju

### `src/lib/actions/inventory.ts`
- `getMaterials()` — svi materijali kompanije
- `createMaterial(data)` — novi materijal
- `updateMaterial(id, data)` — izmjena materijala
- `getInventoryItems()` — sva gotova roba
- `createInventoryItem(data)` — novi artikal
- `updateInventoryItem(id, data)` — izmjena artikla
- `receiveMaterial(materialId, quantity, note?)` — prijem materijala, kreira movement
- `receiveInventoryItem(itemId, quantity, note?)` — prijem gotove robe
- `generateMaterialBarcode(materialId)` — generiše barkod `MM-MAT-XXXXXXXX`
- `generateInventoryItemBarcode(itemId)` — generiše barkod `MM-INV-XXXXXXXX`
- `lookupByBarcode(barcode)` — traži po barkodu, vraća `{type, item}` ili `null`
- `getInventoryMovements()` — zadnjih 100 kretanja

### `src/lib/actions/sales.ts`
- `getSales()` — lista prodaja sa customer, items join
- `createSale(data)` — nova prodaja, smanjuje inventory, kreira saleItems

### `src/lib/actions/appointments.ts`
- `getAppointments(from?, to?)` — termini po datumu sa customer join
- `createAppointment(data)` — novi termin
- `updateAppointmentStatus(id, status)` — scheduled | completed | cancelled | no_show
- `updateAppointment(id, data)` — izmjena termina
- `deleteAppointment(id)` — brisanje termina

### `src/lib/actions/suppliers.ts`
- `getSuppliers()` — lista dobavljača
- `createSupplier(data)` — novi dobavljač
- `updateSupplier(id, data)` — izmjena dobavljača
- `getSupplierInvoices()` — lista faktura sa supplier, items, costs join
- `getSupplierInvoice(id)` — detalji fakture
- `createSupplierInvoice(data)` — nova faktura; automatski:
  - izračunava subtotal
  - alocira troškove proporcionalno po vrijednosti stavki
  - računa `finalUnitCost` po stavci: `(stavka + alociraniTroškovi) / količina`
  - ažurira `lastPurchasePrice` / `costPrice` na artiklima
- `postInvoice(id)` — knjiženje fakture: povećava stanje zaliha, kreira movements, status → "posted"

### `src/lib/actions/auth.ts`
- Supabase Auth helperi za login/logout

### `src/lib/actions/settings.ts`
- `getCompanySettings()` — podaci o kompaniji
- `updateCompanySettings(data)` — izmjena podešavanja

### `src/lib/actions/notifications.ts`
- Placeholder — nije implementirano

---

## 7. Stranice (Routes)

| Route | Opis | Status |
|---|---|---|
| `/` | Redirect na `/dashboard` ili `/login` | ✅ |
| `/login` | Stranica za prijavu | ✅ |
| `/dashboard` | Glavni dashboard sa KPI karticama, grafikonom, terminima danas | ✅ |
| `/customers` | Lista klijenata sa pretragom | ✅ |
| `/customers/[id]` | Profil klijenta (merenja, nalozi, korekcije, loyalty) | ✅ |
| `/appointments` | Termini — week view + list view | ✅ |
| `/orders` | Lista naloga sa filterima (status, neplaćeni, kašnjenje) | ✅ |
| `/orders/new` | Wizard za kreiranje naloga | ✅ |
| `/orders/[id]` | Detalji naloga sa statusima, plaćanjem | ✅ |
| `/production` | Kanban board produkcije | ✅ |
| `/corrections` | Lista korekcija | ✅ |
| `/inventory` | Materijali + gotova roba sa stanjem | ✅ |
| `/barcodes` | Generisanje, skeniranje i štampa barkodova | ✅ |
| `/sales` | POS prodaja + istorija | ✅ |
| `/suppliers` | Dobavljači + fakture sa landed cost kalkulacijom | ✅ |
| `/reports` | Finansijski izvještaji sa grafikonima | ✅ |
| `/companies` | Upravljanje firmama | ⚠️ placeholder |
| `/settings` | Podešavanja firme | ✅ |

---

## 8. UI Komponente — ključne funkcionalnosti

### `/dashboard`
- 4 KPI kartice (klikabilne → vode na odgovarajuću stranicu):
  - Prihod → `/reports`
  - Aktivni nalozi → `/orders`
  - Nenaplaćeno → `/orders?filter=unpaid`
  - Klijenti → `/customers`
- Bar chart prihoda po mjesecima (Recharts)
- Lista aktivnih naloga (top 4)
- Produkcija pregled (klikabilan → `/production`)
- Pregled isporuka, korekcija, klijenata
- Termini danas (klikabilno → `/appointments`)

### `/orders`
- Filteri: Svi / Aktivni / Prekoračen rok / Isporučeni / **Neplaćeni** (crveni tab)
- `?filter=unpaid` query param inicijalizuje filter iz URL-a
- Neplaćeni: `paymentStatus !== "paid" && status !== "cancelled"`

### `/barcodes`
- Tab "Skeniranje": input čeka USB HID skener (Enter trigger), pronalazi artikal, prijem sa količinom
- Tab "Generisanje": grid svih artikala, generiši barkod dugme, vizualni Code128
- Tab "Štampa labela": checkbox odabir, otvara novi tab sa JSBarcode CDN, print

### `/appointments`
- Week view: grid 8:00–20:00 × 7 dana, klik na prazan slot → nova forma
- List view: predstojeći + prošli sa akcijama
- Tipovi: merenje (plava), proba (ljubičasta), isporuka (zelena), konsultacija (žuta), ostalo (siva)

### `/suppliers`
- Tab "Fakture": expandabilne kartice, stavke sa finalUnitCost, "Knjiži fakturu"
- Tab "Dobavljači": grid kartica
- Modal nova faktura: carina se unosi kao % → automatski računa iznos od subtotala

---

## 9. Implementirano (✅) vs Nije implementirano (❌)

### ✅ Implementirano
- Auth (login, logout, middleware zaštita)
- Multi-company arhitektura
- CRM — klijenti, profili, merenja, loyalty
- Nalozi — kreiranje, status flow, plaćanje, produkcija
- Produkcija — kanban board, zadaci
- Korekcije — evidencija, slanje u produkciju
- Zalihe — materijali, gotova roba, kretanja
- Barkodovi — generisanje (MM-MAT/MM-INV format), skeniranje, štampa
- Prodaja — POS, saleItems, inventory smanjivanje
- Dobavljači — CRUD + landed cost fakture
- Fakture dobavljača — stavke, troškovi, alokacija, knjiženje
- Termini — week view, list view, CRUD
- Dashboard — KPI kartice, grafikon, termini danas, sve klikabilno
- Reports — grafički prikaz prihoda
- Settings — podešavanja firme
- Admin nalog sa svim pristupom

### ❌ Nije implementirano (prioritet za sljedeće korake)
1. **Email notifikacije** — kada je nalog gotov, kada klijent dugo nije bio (Resend setup)
2. **Company management UI** — stranica `/companies` je placeholder; dodavanje Španije kroz UI
3. **Termini u profilu klijenta** — tab sa terminima direktno na customer profilu
4. **Bulk import klijenata** — CSV upload za retroaktivni unos starih podataka
5. **Row Level Security (RLS)** — trenutno filtriranje na app nivou; treba RLS u produkciji
6. **gocreate.nu integracija** — čeka API pristup od partnera
7. **Lojalnost napredna** — automatsko dodavanje poena pri kupovini (djelimično), redemption UI
8. **Fiskalizacija** — e-Fiskalizacija Crna Gora (zakonski zahtjev, istražiti)
9. **Deploy na Vercel** — projekat nema git repo, nije na webu

---

## 10. Deploy plan (još nije urađeno)

```bash
# 1. Git inicijalizacija
cd C:\Users\acer\Desktop\millimeter-app
git init
git add .
git commit -m "Initial commit"

# 2. GitHub repo (kreirati na github.com)
git remote add origin https://github.com/KORISNIK/millimeter-app.git
git push -u origin main

# 3. Vercel deploy
# → vercel.com → Import project → odaberi GitHub repo
# → Dodaj env varijable iz .env.local:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   DATABASE_URL

# BITNO: .env.local je u .gitignore — ne commitovati kredencijale!
```

### Supabase produkcijska podešavanja
- Prebaciti `max: 3` konekcije na `max: 10` za produkciju u `src/lib/db/index.ts`
- Dodati RLS politike na sve tabele
- Podesiti Supabase Auth → Site URL na Vercel domain
- Dodati Vercel domain u Supabase Auth Redirect URLs

---

## 11. Česte greške i rješenja

### `npx tsc --noEmit` ne radi
Instalira pogrešni `tsc` paket. Koristiti: `npx next build`

### `DATABASE_URL is not defined` kod drizzle-kit
```powershell
$env:DATABASE_URL="postgresql://..."; npx drizzle-kit push
```

### EMAXCONN — previše konekcija
Singleton pattern u `src/lib/db/index.ts` sprječava ovo u dev modu. U produkciji povećati `max`.

### `prepare: false` je obavezno
Supabase PgBouncer transaction pooler ne podržava prepared statements.

---

## 12. Konvencije koda

- Sve stranice su `async` server components koji fetchuju podatke i proslijeđuju ih client komponentama
- Nikad fetching u client komponentama — sve ide kroz server actions
- Mutacije: `useTransition` + server action + `router.refresh()`
- Sve tabele imaju `companyId` guard u server actions (via `getCurrentUser()`)
- Barkod format: `MM-MAT-XXXXXXXX` (materijali), `MM-INV-XXXXXXXX` (inventar) — zadnjih 8 znakova UUID-a bez crtice
- Landed cost alokacija: proporcionalno po vrijednosti stavke (stavka.total / subtotal × ukupniTroškovi)
- Loyalty tier: Bronze (0–499 bodova), Silver (500–1999), Gold (2000–4999), Platinum (5000+)
- Komentare pisati samo kada je razlog neočigledan

---

## 13. Poslovni kontekst

Firma ima radnje u **Crnoj Gori** (MVP) i planira proširenje u **Španiju** (Faza 2).

### Tok naloga
```
Draft → Potvrđen → U produkciji → Gotov → Isporučen
                                         ↑
                                    (Korekcije ←→ U produkciji)
```

### Produkcijski tok
```
Radnja kreira nalog → Šalje u produkciju → Produkcija prima (queued) →
→ Počinju raditi (in_progress) → Gotovo (done) → Šalju u radnju (sent_to_store) →
→ Radnja isporučuje klijentu
```

### Materijali vs Inventar
- `materials` — sirovine: tkanine, postave, dugmad, konac (mjeri se u m, kom, kg)
- `inventory_items` — gotova roba za prodaju (odijela, košulje sa police)
- Slobodan stock = `currentStock - reservedStock`

---

*CLAUDE.md ažuriran: 2026-05-15*
