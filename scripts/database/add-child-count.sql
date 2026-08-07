-- Child passengers for RSH pickup only.
-- Children ride free on the ticket (not in ticket guest counts) but must be
-- counted for pickup capacity. Ops used to encode this as "+1C" in seat.

ALTER TABLE public.cad_yip_bookings
  ADD COLUMN IF NOT EXISTS child_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cad_yip_bookings.child_count IS
  'Manual child count for RSH pickup capacity. Free on ticket; paid/counted for pickup. Not sourced from Woo.';

-- Best-effort backfill from legacy seat notes: "+1C", "+ 2 C", "+2CHD"
-- Note: Postgres regex has no \b word-boundary; use C(?:HD)? instead.
UPDATE public.cad_yip_bookings
SET child_count = COALESCE(
  (regexp_match(seat, '\+\s*(\d+)\s*C(?:HD)?', 'i'))[1]::integer,
  0
)
WHERE child_count = 0
  AND seat ~* '\+\s*\d+\s*C';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cad_yip_bookings_child_count_check'
  ) THEN
    ALTER TABLE public.cad_yip_bookings
      ADD CONSTRAINT cad_yip_bookings_child_count_check
      CHECK (child_count >= 0 AND child_count <= 50);
  END IF;
END $$;
