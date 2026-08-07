-- WooCommerce refund support for cad_yip_* tables
-- Rules: any refund (partial or full) ⇒ booking is_cancelled = true
-- Completed orders can still have refund evidence via WC refunds API.

-- ---------------------------------------------------------------------------
-- A. Booking summary columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.cad_yip_bookings
  ADD COLUMN IF NOT EXISTS amount_refunded numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_net numeric,
  ADD COLUMN IF NOT EXISTS woo_status text,
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cancel_source text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Backfill net = amount when null
UPDATE public.cad_yip_bookings
SET amount_net = amount
WHERE amount_net IS NULL;

COMMENT ON COLUMN public.cad_yip_bookings.amount IS
  'Gross line sale amount from Woo line item (do not overwrite with net).';
COMMENT ON COLUMN public.cad_yip_bookings.amount_refunded IS
  'Sum of refund amounts allocated to this booking (absolute currency units).';
COMMENT ON COLUMN public.cad_yip_bookings.amount_net IS
  'amount - amount_refunded; use for financial reporting after refunds.';
COMMENT ON COLUMN public.cad_yip_bookings.woo_status IS
  'Last known WooCommerce order status (completed, refunded, cancelled, ...).';
COMMENT ON COLUMN public.cad_yip_bookings.refund_status IS
  'none | partial | full — any refund implies is_cancelled = true.';
COMMENT ON COLUMN public.cad_yip_bookings.cancel_source IS
  'woo | dashboard | system — provenance of is_cancelled.';
COMMENT ON COLUMN public.cad_yip_bookings.refunded_at IS
  'Timestamp of the latest refund affecting this booking.';
COMMENT ON COLUMN public.cad_yip_bookings.last_synced_at IS
  'When this booking row was last updated by Woo sync.';

-- Constraints (add only if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cad_yip_bookings_refund_status_check'
  ) THEN
    ALTER TABLE public.cad_yip_bookings
      ADD CONSTRAINT cad_yip_bookings_refund_status_check
      CHECK (refund_status IN ('none', 'partial', 'full'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cad_yip_bookings_cancel_source_check'
  ) THEN
    ALTER TABLE public.cad_yip_bookings
      ADD CONSTRAINT cad_yip_bookings_cancel_source_check
      CHECK (cancel_source IS NULL OR cancel_source IN ('woo', 'dashboard', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cad_yip_bookings_woo_id
  ON public.cad_yip_bookings (woo_id);
CREATE INDEX IF NOT EXISTS idx_cad_yip_bookings_woo_status
  ON public.cad_yip_bookings (woo_status);
CREATE INDEX IF NOT EXISTS idx_cad_yip_bookings_refund_status
  ON public.cad_yip_bookings (refund_status);

-- ---------------------------------------------------------------------------
-- B. Refund ledger (one row per Woo refund document)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cad_yip_refunds (
  id                bigserial PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  woo_order_id      bigint NOT NULL,
  woo_refund_id     bigint NOT NULL,
  woo_status        text,
  amount            numeric NOT NULL,
  reason            text,
  refunded_at       timestamptz,
  refunded_by       bigint,
  refunded_payment  boolean,
  raw               jsonb,
  UNIQUE (woo_refund_id)
);

CREATE INDEX IF NOT EXISTS idx_cad_yip_refunds_order
  ON public.cad_yip_refunds (woo_order_id);
CREATE INDEX IF NOT EXISTS idx_cad_yip_refunds_refunded_at
  ON public.cad_yip_refunds (refunded_at DESC);

COMMENT ON TABLE public.cad_yip_refunds IS
  'WooCommerce refund documents (order-level). Source of truth for refund history.';

-- ---------------------------------------------------------------------------
-- C. Refund line items (allocation to bookings)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cad_yip_refund_items (
  id                bigserial PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  refund_id         bigint NOT NULL REFERENCES public.cad_yip_refunds(id) ON DELETE CASCADE,
  woo_refund_id     bigint NOT NULL,
  woo_order_id      bigint NOT NULL,
  woo_line_item_id  bigint,
  sku               text,
  product_name      text,
  quantity          numeric,
  line_total        numeric NOT NULL DEFAULT 0,
  booking_id        bigint REFERENCES public.cad_yip_bookings(id) ON DELETE SET NULL
);

-- Prefer stable identity when Woo line id is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_cad_yip_refund_items_woo_line
  ON public.cad_yip_refund_items (woo_refund_id, woo_line_item_id)
  WHERE woo_line_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cad_yip_refund_items_booking
  ON public.cad_yip_refund_items (booking_id);
CREATE INDEX IF NOT EXISTS idx_cad_yip_refund_items_order
  ON public.cad_yip_refund_items (woo_order_id);
CREATE INDEX IF NOT EXISTS idx_cad_yip_refund_items_sku
  ON public.cad_yip_refund_items (woo_order_id, sku);

COMMENT ON TABLE public.cad_yip_refund_items IS
  'Line-level refund allocation; booking_id set when SKU/line matches cad_yip_bookings.';
