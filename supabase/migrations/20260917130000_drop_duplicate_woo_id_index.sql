-- 20260917120000_speed_up_booking_page_search added cad_yip_bookings_woo_id_idx
-- on (woo_id), but scripts/database/add-refunds.sql already created
-- idx_cad_yip_bookings_woo_id on the same column. Two identical btree indexes
-- double the write cost of every booking upsert (Woo syncs rewrite all rows)
-- while only one can ever be used. Keep the original, drop the duplicate.
drop index if exists public.cad_yip_bookings_woo_id_idx;
