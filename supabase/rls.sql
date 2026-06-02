-- ============================================================
-- Millimeter App — Row Level Security (RLS)
-- Supabase Dashboard → SQL Editor → pokrenuti odjednom
--
-- Arhitektura:
--   • Drizzle (postgres role) → zaobilazi RLS — app radi normalno
--   • Supabase PostgREST API → RLS štiti direktan pristup
--   • Svi autentifikovani korisnici vide samo svoju firmu
--   • Anon korisnici ne vide ništa (nema anon policy-ja)
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- KORAK 1: Helper funkcija (izbjegava rekurziju na users tabeli)
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = auth.uid()
$$;

-- ──────────────────────────────────────────────────────────
-- KORAK 2: Brisanje starih policy-ja (idempotentno)
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "company_isolation" ON companies;
DROP POLICY IF EXISTS "company_isolation" ON users;
DROP POLICY IF EXISTS "company_isolation" ON customers;
DROP POLICY IF EXISTS "company_isolation" ON customer_measurements;
DROP POLICY IF EXISTS "company_isolation" ON materials;
DROP POLICY IF EXISTS "company_isolation" ON inventory_items;
DROP POLICY IF EXISTS "company_isolation" ON orders;
DROP POLICY IF EXISTS "company_isolation" ON material_reservations;
DROP POLICY IF EXISTS "company_isolation" ON production_tasks;
DROP POLICY IF EXISTS "company_isolation" ON corrections;
DROP POLICY IF EXISTS "company_isolation" ON inventory_movements;
DROP POLICY IF EXISTS "company_isolation" ON sales;
DROP POLICY IF EXISTS "company_isolation" ON sale_items;
DROP POLICY IF EXISTS "company_isolation" ON payments;
DROP POLICY IF EXISTS "company_isolation" ON loyalty_events;
DROP POLICY IF EXISTS "company_isolation" ON appointments;
DROP POLICY IF EXISTS "company_isolation" ON suppliers;
DROP POLICY IF EXISTS "company_isolation" ON supplier_invoices;
DROP POLICY IF EXISTS "company_isolation" ON supplier_invoice_items;
DROP POLICY IF EXISTS "company_isolation" ON invoice_additional_costs;
DROP POLICY IF EXISTS "company_isolation" ON audit_logs;

-- ──────────────────────────────────────────────────────────
-- KORAK 3: Uključivanje RLS na svim tabelama
-- ──────────────────────────────────────────────────────────

ALTER TABLE companies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_measurements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_additional_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
-- KORAK 4: Policy-ji za tabele sa direktnim company_id
-- ──────────────────────────────────────────────────────────

-- companies: user vidi samo svoju firmu (id = company_id usera)
CREATE POLICY "company_isolation" ON companies
  AS PERMISSIVE FOR ALL TO authenticated
  USING (id = get_my_company_id())
  WITH CHECK (id = get_my_company_id());

-- users: user vidi samo korisnike iste firme
CREATE POLICY "company_isolation" ON users
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- customers
CREATE POLICY "company_isolation" ON customers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- materials
CREATE POLICY "company_isolation" ON materials
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- inventory_items
CREATE POLICY "company_isolation" ON inventory_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- orders
CREATE POLICY "company_isolation" ON orders
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- production_tasks
CREATE POLICY "company_isolation" ON production_tasks
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- corrections
CREATE POLICY "company_isolation" ON corrections
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- inventory_movements
CREATE POLICY "company_isolation" ON inventory_movements
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- sales
CREATE POLICY "company_isolation" ON sales
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- payments
CREATE POLICY "company_isolation" ON payments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- appointments
CREATE POLICY "company_isolation" ON appointments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- suppliers
CREATE POLICY "company_isolation" ON suppliers
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- supplier_invoices
CREATE POLICY "company_isolation" ON supplier_invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- audit_logs (company_id je nullable — logovi bez firme nisu vidljivi)
CREATE POLICY "company_isolation" ON audit_logs
  AS PERMISSIVE FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- ──────────────────────────────────────────────────────────
-- KORAK 5: Policy-ji za djeca tabele (nema direktnog company_id)
-- ──────────────────────────────────────────────────────────

-- customer_measurements → nasljeđuje zaštitu od customers
CREATE POLICY "company_isolation" ON customer_measurements
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = customer_id
      AND c.company_id = get_my_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = customer_id
      AND c.company_id = get_my_company_id()
  ));

-- material_reservations → nasljeđuje zaštitu od orders
CREATE POLICY "company_isolation" ON material_reservations
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
      AND o.company_id = get_my_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
      AND o.company_id = get_my_company_id()
  ));

-- sale_items → nasljeđuje zaštitu od sales
CREATE POLICY "company_isolation" ON sale_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_id
      AND s.company_id = get_my_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales s
    WHERE s.id = sale_id
      AND s.company_id = get_my_company_id()
  ));

-- loyalty_events → nasljeđuje zaštitu od customers
CREATE POLICY "company_isolation" ON loyalty_events
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = customer_id
      AND c.company_id = get_my_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = customer_id
      AND c.company_id = get_my_company_id()
  ));

-- supplier_invoice_items → nasljeđuje zaštitu od supplier_invoices
CREATE POLICY "company_isolation" ON supplier_invoice_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = invoice_id
      AND si.company_id = get_my_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = invoice_id
      AND si.company_id = get_my_company_id()
  ));

-- invoice_additional_costs → nasljeđuje zaštitu od supplier_invoices
CREATE POLICY "company_isolation" ON invoice_additional_costs
  AS PERMISSIVE FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = invoice_id
      AND si.company_id = get_my_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM supplier_invoices si
    WHERE si.id = invoice_id
      AND si.company_id = get_my_company_id()
  ));

-- ──────────────────────────────────────────────────────────
-- VERIFIKACIJA: provjeri da su sve tabele zaštićene
-- ──────────────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
