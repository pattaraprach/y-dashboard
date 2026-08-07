-- Woo order date (order.date_created) for sales-period metrics.
-- cad_yip_bookings.created_at is Supabase insert time and moves on re-import.
ALTER TABLE public.cad_yip_bookings
  ADD COLUMN IF NOT EXISTS order_created_at timestamptz NULL;

COMMENT ON COLUMN public.cad_yip_bookings.order_created_at IS
  'WooCommerce order.date_created — sales month/day charts use this, not created_at';

CREATE INDEX IF NOT EXISTS cad_yip_bookings_order_created_at_idx
  ON public.cad_yip_bookings (order_created_at DESC NULLS LAST);
