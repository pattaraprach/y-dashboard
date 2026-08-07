/**
 * RSH pickup child counts.
 * Children are free on the ticket (excluded from ticket guest metrics) but
 * must be counted for RSH pickup headcount. Ops used to append "+1C" to seat.
 */

/** Parse legacy seat notes: "+1C", "A12 +2c", "+ 3 C", "+2CHD". */
export function parseChildCountFromSeat(seat: string | null | undefined): number {
  if (!seat) return 0
  const match = seat.match(/\+\s*(\d+)\s*C(?:HD)?\b/i)
  if (!match) return 0
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Prefer explicit column; fall back to legacy +NC seat suffix. */
export function getChildCount(booking: {
  child_count?: number | null
  seat?: string | null
}): number {
  const stored = booking.child_count
  if (typeof stored === 'number' && stored > 0) return stored
  if (typeof stored === 'number' && stored === 0) {
    // Still allow seat fallback for rows not yet migrated / mid-edit
    return parseChildCountFromSeat(booking.seat)
  }
  return parseChildCountFromSeat(booking.seat)
}

/** Ticket guests = named attendees only (children free → not included). */
export function ticketGuestCount(booking: {
  cad_yip_attendees?: { length: number } | null
}): number {
  return booking.cad_yip_attendees?.length || 0
}

/**
 * RSH pickup headcount = adults (attendees) + children.
 * Only meaningful for is_rsh_transfer bookings.
 */
export function rshPickupHeadcount(booking: {
  is_rsh_transfer?: boolean | null
  cad_yip_attendees?: { length: number } | null
  child_count?: number | null
  seat?: string | null
}): number {
  if (!booking.is_rsh_transfer) return ticketGuestCount(booking)
  return ticketGuestCount(booking) + getChildCount(booking)
}

/** Display suffix for tables/export, e.g. "+1C". Empty when zero. */
export function formatChildCountSuffix(count: number): string {
  if (count <= 0) return ''
  return `+${count}C`
}
