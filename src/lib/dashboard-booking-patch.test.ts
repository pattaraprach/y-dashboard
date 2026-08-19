import { describe, expect, it } from 'vitest'
import { applyBookingOpsPatch } from './dashboard-booking-patch'
import type { BookingWithAttendees, DashboardMetrics } from '@/types/database'

const booking = {
  id: 1,
  is_rsh_transfer: true,
  is_cancelled: false,
  event_date: '2026-11-01',
  phone_e164: '+66812345678',
  seat: 'A1',
  pickup_loc: 'Lobby',
  child_count: 1,
  cad_yip_attendees: [],
} as unknown as BookingWithAttendees

const metrics = {
  rshAttendees: 10,
  rshAttendeesByDay: [{ date: '2026-11-01', count: 10 }],
} as DashboardMetrics

describe('applyBookingOpsPatch', () => {
  it('patches the booking and updates child-dependent RSH metrics', () => {
    const result = applyBookingOpsPatch([booking], metrics, {
      id: 1,
      phone_raw: '+66 81 234 5678',
      phone_e164: null,
      seat: 'B2',
      pickup_loc: 'Gate',
      child_count: 3,
    })

    expect(result.bookings[0]).toMatchObject({
      seat: 'B2',
      phone_raw: '+66 81 234 5678',
      phone_e164: null,
      pickup_loc: 'Gate',
      child_count: 3,
    })
    expect(result.metrics).toMatchObject({
      rshAttendees: 12,
      rshAttendeesByDay: [{ date: '2026-11-01', count: 12 }],
    })
  })

  it('keeps existing references when the booking is absent', () => {
    const bookings = [booking]
    const result = applyBookingOpsPatch(bookings, metrics, {
      id: 2,
      phone_raw: null,
      phone_e164: null,
      seat: null,
      pickup_loc: null,
      child_count: 0,
    })

    expect(result.bookings).toBe(bookings)
    expect(result.metrics).toBe(metrics)
  })
})
