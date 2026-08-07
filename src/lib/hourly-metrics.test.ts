import { describe, expect, it } from 'vitest'
import type { BookingWithAttendees } from '@/types/database'
import { buildHourlyMetrics } from './hourly-metrics'

function booking(partial: Partial<BookingWithAttendees> & { id: number }): BookingWithAttendees {
  return {
    created_at: null,
    order_created_at: null,
    woo_id: partial.id,
    firstname: 'Test',
    lastname: 'User',
    email: 't@example.com',
    phone_raw: null,
    phone_e164: null,
    country: null,
    sku: 'CADCNX',
    seat: null,
    is_rsh_transfer: false,
    pickup_loc: null,
    amount: 1000,
    commission: 0,
    fees: 0,
    gateway: null,
    event_date: null,
    zone_code: null,
    zone: null,
    event_type: null,
    is_cancelled: false,
    quantity: 1,
    pickup_type: null,
    pickup_link: null,
    amount_refunded: 0,
    amount_net: 1000,
    woo_status: 'completed',
    refund_status: 'none',
    cancel_source: null,
    cancelled_at: null,
    refunded_at: null,
    last_synced_at: null,
    cad_yip_attendees: [],
    ...partial,
  }
}

describe('buildHourlyMetrics', () => {
  // Fixed "now": 2026-08-07T12:00:00.000Z
  const nowMs = Date.parse('2026-08-07T12:00:00.000Z')

  it('returns 24 buckets relative to nowMs', () => {
    const metrics = buildHourlyMetrics([], nowMs)
    expect(metrics).toHaveLength(24)
    expect(metrics.every((m) => typeof m.label === 'string')).toBe(true)
  })

  it('counts active bookings in the correct hour slot', () => {
    // 90 minutes ago → slot for hour index that covers [now-2h, now-1h) or [now-1h, now)
    // sold at now - 30 min → last slot (i=23): slotStart = now-1h, slotEnd = now
    const soldAt = new Date(nowMs - 30 * 60_000).toISOString()
    const rows = [
      booking({
        id: 1,
        order_created_at: soldAt,
        is_rsh_transfer: true,
        cad_yip_attendees: [
          { id: 1, attendee_firstname: 'A', attendee_lastname: 'One' },
          { id: 2, attendee_firstname: 'B', attendee_lastname: 'Two' },
        ],
      }),
    ]

    const metrics = buildHourlyMetrics(rows, nowMs)
    const last = metrics[23]
    expect(last.totalOrders).toBe(1)
    expect(last.rshOrders).toBe(1)
    expect(last.nonRshOrders).toBe(0)
    expect(last.totalGuests).toBe(2)
  })

  it('excludes cancelled bookings from order counts', () => {
    const soldAt = new Date(nowMs - 30 * 60_000).toISOString()
    const rows = [
      booking({
        id: 1,
        order_created_at: soldAt,
        is_cancelled: true,
        cad_yip_attendees: [{ id: 1, attendee_firstname: 'A', attendee_lastname: 'One' }],
      }),
    ]

    const metrics = buildHourlyMetrics(rows, nowMs)
    expect(metrics.every((m) => m.totalOrders === 0)).toBe(true)
  })

  it('ignores bookings outside the last 24 hours', () => {
    const tooOld = new Date(nowMs - 25 * 3_600_000).toISOString()
    const rows = [booking({ id: 1, order_created_at: tooOld })]
    const metrics = buildHourlyMetrics(rows, nowMs)
    expect(metrics.every((m) => m.totalOrders === 0)).toBe(true)
  })
})
