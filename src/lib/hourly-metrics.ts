import type { BookingWithAttendees, HourlyMetrics } from '@/types/database'

function salesTimestamp(booking: {
  order_created_at?: string | null
  created_at?: string | null
}): string | null {
  return booking.order_created_at || booking.created_at || null
}

/**
 * Rolling last-24h buckets relative to `nowMs` (default Date.now()).
 * Keep this out of long-lived server cache so labels/slots move with wall clock.
 */
export function buildHourlyMetrics(
  bookings: BookingWithAttendees[],
  nowMs: number = Date.now()
): HourlyMetrics[] {
  const active = bookings.filter((b) => !b.is_cancelled)
  const guestsById = new Map<number, number>()
  for (const b of bookings) {
    guestsById.set(b.id, b.cad_yip_attendees?.length || 0)
  }

  return Array.from({ length: 24 }, (_, i) => {
    const slotStart = nowMs - (24 - i) * 3_600_000
    const slotEnd = nowMs - (23 - i) * 3_600_000
    // Display label may collide across DST fall-back; key uses slotStart ms.
    const label = new Date(slotStart).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })

    let totalOrders = 0
    let rshOrders = 0
    let nonRshOrders = 0
    let totalGuests = 0

    for (const b of active) {
      const soldAt = salesTimestamp(b)
      if (!soldAt) continue
      const ts = new Date(soldAt).getTime()
      if (ts >= slotStart && ts < slotEnd) {
        totalOrders++
        if (b.is_rsh_transfer) rshOrders++
        else nonRshOrders++
        totalGuests += guestsById.get(b.id) || 0
      }
    }

    return {
      label,
      // Stable React key across DST when display labels collide.
      slotKey: String(slotStart),
      totalOrders,
      rshOrders,
      nonRshOrders,
      totalGuests,
    }
  })
}
