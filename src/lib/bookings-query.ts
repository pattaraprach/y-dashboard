/**
 * Shared Supabase query helpers for dashboard bookings.
 * Keep selects lean and always filter event code on the server.
 */

/** Columns needed for metrics, table, export, and order modal shell. */
export const BOOKING_SELECT = [
  'id',
  'created_at',
  'order_created_at',
  'woo_id',
  'firstname',
  'lastname',
  'email',
  'phone_e164',
  'country',
  'sku',
  'seat',
  'is_rsh_transfer',
  'pickup_loc',
  'amount',
  'commission',
  'fees',
  'event_date',
  'zone_code',
  'zone',
  'event_type',
  'is_cancelled',
  'amount_refunded',
  'amount_net',
  'woo_status',
  'refund_status',
  'cancel_source',
  'cancelled_at',
  'refunded_at',
  'last_synced_at',
  'cad_yip_attendees(id, attendee_firstname, attendee_lastname)',
].join(',')

export const BOOKING_PAGE_SIZE = 500

/** PostgREST ilike pattern: SKU contains event code (CADCNX / CADNYE). */
export function eventSkuFilter(eventCode: string): string {
  return `%${eventCode}%`
}
