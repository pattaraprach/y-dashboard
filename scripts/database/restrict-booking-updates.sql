-- Optional hardening: prefer server actions for ops mutations.
-- App already uses allowlisted server actions (updateBookingOpsFields / setBookingCancelled).
-- This script does NOT drop authenticated UPDATE yet (would break legacy clients until
-- all writers use RPCs). It documents the intended next step.
--
-- Recommended follow-up (manual):
-- 1. Deploy app that only mutates via server actions.
-- 2. DROP POLICY "cad_yip_bookings_update_authenticated"
-- 3. CREATE POLICY update only for service_role, or use SECURITY DEFINER RPCs below.

-- Allowlisted seat/pickup update (callable from PostgREST if needed later)
CREATE OR REPLACE FUNCTION public.update_booking_ops_fields(
  p_booking_id bigint,
  p_seat text,
  p_pickup_loc text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.cad_yip_bookings
  SET
    seat = p_seat,
    pickup_loc = p_pickup_loc
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_ops_fields(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_ops_fields(bigint, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_booking_cancelled(
  p_booking_id bigint,
  p_cancelled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.cad_yip_bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO r FROM public.cad_yip_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF p_cancelled = false AND r.refund_status IS NOT NULL AND r.refund_status <> 'none' THEN
    RAISE EXCEPTION 'Cannot restore while Woo refund evidence remains';
  END IF;

  IF p_cancelled THEN
    UPDATE public.cad_yip_bookings
    SET
      is_cancelled = true,
      cancel_source = 'dashboard',
      cancelled_at = now()
    WHERE id = p_booking_id;
  ELSE
    UPDATE public.cad_yip_bookings
    SET
      is_cancelled = false,
      cancel_source = null,
      cancelled_at = null
    WHERE id = p_booking_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_booking_cancelled(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_booking_cancelled(bigint, boolean) TO authenticated;
