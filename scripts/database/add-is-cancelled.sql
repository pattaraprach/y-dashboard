-- Mark bookings as cancelled (soft cancel; keeps history for reporting)
-- Applied to project rsh-dLake (dibrdkzmwknjajgwvxyg) on 2026-07-31

ALTER TABLE public.cad_yip_bookings
  ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cad_yip_bookings.is_cancelled IS
  'When true, booking is cancelled and excluded from active metrics';

CREATE INDEX IF NOT EXISTS idx_cad_yip_bookings_is_cancelled
  ON public.cad_yip_bookings (is_cancelled);
