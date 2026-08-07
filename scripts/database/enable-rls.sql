-- Enable Row Level Security on all cad_yip_* tables.
-- Goal: no unrestricted public access; app still works for signed-in ops.
--
-- Access model:
--   • anon (publishable key, no session)  → denied
--   • authenticated (logged-in dashboard) → full CRUD on all ops tables
--   • service_role (SUPABASE_SERVICE_KEY) → bypasses RLS (sync / admin scripts)
--
-- Run in Supabase SQL editor after add-refunds.sql (or anytime; idempotent).

-- ---------------------------------------------------------------------------
-- Helper: drop policy if exists (Postgres has no IF NOT EXISTS for policies)
-- ---------------------------------------------------------------------------
-- We use DROP POLICY IF EXISTS then CREATE.

-- ---------------------------------------------------------------------------
-- Tables covered
-- ---------------------------------------------------------------------------
-- cad_yip_bookings
-- cad_yip_attendees
-- cad_yip_links
-- cad_yip_prices
-- cad_yip_refunds
-- cad_yip_refund_items

-- ========================= cad_yip_bookings =========================
ALTER TABLE public.cad_yip_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_yip_bookings_select_authenticated" ON public.cad_yip_bookings;
DROP POLICY IF EXISTS "cad_yip_bookings_insert_authenticated" ON public.cad_yip_bookings;
DROP POLICY IF EXISTS "cad_yip_bookings_update_authenticated" ON public.cad_yip_bookings;
DROP POLICY IF EXISTS "cad_yip_bookings_delete_authenticated" ON public.cad_yip_bookings;

CREATE POLICY "cad_yip_bookings_select_authenticated"
  ON public.cad_yip_bookings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cad_yip_bookings_insert_authenticated"
  ON public.cad_yip_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cad_yip_bookings_update_authenticated"
  ON public.cad_yip_bookings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cad_yip_bookings_delete_authenticated"
  ON public.cad_yip_bookings
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================= cad_yip_attendees =========================
ALTER TABLE public.cad_yip_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_yip_attendees_select_authenticated" ON public.cad_yip_attendees;
DROP POLICY IF EXISTS "cad_yip_attendees_insert_authenticated" ON public.cad_yip_attendees;
DROP POLICY IF EXISTS "cad_yip_attendees_update_authenticated" ON public.cad_yip_attendees;
DROP POLICY IF EXISTS "cad_yip_attendees_delete_authenticated" ON public.cad_yip_attendees;

CREATE POLICY "cad_yip_attendees_select_authenticated"
  ON public.cad_yip_attendees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cad_yip_attendees_insert_authenticated"
  ON public.cad_yip_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cad_yip_attendees_update_authenticated"
  ON public.cad_yip_attendees
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cad_yip_attendees_delete_authenticated"
  ON public.cad_yip_attendees
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================= cad_yip_links =========================
ALTER TABLE public.cad_yip_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_yip_links_select_authenticated" ON public.cad_yip_links;
DROP POLICY IF EXISTS "cad_yip_links_insert_authenticated" ON public.cad_yip_links;
DROP POLICY IF EXISTS "cad_yip_links_update_authenticated" ON public.cad_yip_links;
DROP POLICY IF EXISTS "cad_yip_links_delete_authenticated" ON public.cad_yip_links;

CREATE POLICY "cad_yip_links_select_authenticated"
  ON public.cad_yip_links
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cad_yip_links_insert_authenticated"
  ON public.cad_yip_links
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cad_yip_links_update_authenticated"
  ON public.cad_yip_links
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cad_yip_links_delete_authenticated"
  ON public.cad_yip_links
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================= cad_yip_prices =========================
ALTER TABLE public.cad_yip_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_yip_prices_select_authenticated" ON public.cad_yip_prices;
DROP POLICY IF EXISTS "cad_yip_prices_insert_authenticated" ON public.cad_yip_prices;
DROP POLICY IF EXISTS "cad_yip_prices_update_authenticated" ON public.cad_yip_prices;
DROP POLICY IF EXISTS "cad_yip_prices_delete_authenticated" ON public.cad_yip_prices;

CREATE POLICY "cad_yip_prices_select_authenticated"
  ON public.cad_yip_prices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cad_yip_prices_insert_authenticated"
  ON public.cad_yip_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cad_yip_prices_update_authenticated"
  ON public.cad_yip_prices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cad_yip_prices_delete_authenticated"
  ON public.cad_yip_prices
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================= cad_yip_refunds =========================
ALTER TABLE public.cad_yip_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_yip_refunds_select_authenticated" ON public.cad_yip_refunds;
DROP POLICY IF EXISTS "cad_yip_refunds_insert_authenticated" ON public.cad_yip_refunds;
DROP POLICY IF EXISTS "cad_yip_refunds_update_authenticated" ON public.cad_yip_refunds;
DROP POLICY IF EXISTS "cad_yip_refunds_delete_authenticated" ON public.cad_yip_refunds;

CREATE POLICY "cad_yip_refunds_select_authenticated"
  ON public.cad_yip_refunds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cad_yip_refunds_insert_authenticated"
  ON public.cad_yip_refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cad_yip_refunds_update_authenticated"
  ON public.cad_yip_refunds
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cad_yip_refunds_delete_authenticated"
  ON public.cad_yip_refunds
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================= cad_yip_refund_items =========================
ALTER TABLE public.cad_yip_refund_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cad_yip_refund_items_select_authenticated" ON public.cad_yip_refund_items;
DROP POLICY IF EXISTS "cad_yip_refund_items_insert_authenticated" ON public.cad_yip_refund_items;
DROP POLICY IF EXISTS "cad_yip_refund_items_update_authenticated" ON public.cad_yip_refund_items;
DROP POLICY IF EXISTS "cad_yip_refund_items_delete_authenticated" ON public.cad_yip_refund_items;

CREATE POLICY "cad_yip_refund_items_select_authenticated"
  ON public.cad_yip_refund_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cad_yip_refund_items_insert_authenticated"
  ON public.cad_yip_refund_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "cad_yip_refund_items_update_authenticated"
  ON public.cad_yip_refund_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cad_yip_refund_items_delete_authenticated"
  ON public.cad_yip_refund_items
  FOR DELETE
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
-- • No policies for role `anon` → public/unauthenticated requests get zero rows.
-- • `service_role` bypasses RLS (Woo sync with SUPABASE_SERVICE_KEY still works).
-- • Dashboard must stay logged in (authenticated JWT via @supabase/ssr).
-- • If a table name does not exist yet, this script will error on that table —
--   create refund tables first (add-refunds.sql) or comment those sections out.
