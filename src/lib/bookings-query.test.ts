import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOOKING_QUERY,
  normalizeBookingQuery,
  bookingQueryKey,
} from './bookings-query'

const base = {
  eventCode: 'CADCNX' as const,
  ...DEFAULT_BOOKING_QUERY,
}

describe('normalizeBookingQuery', () => {
  it('trims and caps search so equivalent queries share a key', () => {
    const a = normalizeBookingQuery({ ...base, search: '  smith  ' })
    const b = normalizeBookingQuery({ ...base, search: 'smith' })
    expect(a.search).toBe('smith')
    expect(bookingQueryKey(a)).toBe(bookingQueryKey(b))
  })

  it('does not treat a new search as the previous one', () => {
    expect(bookingQueryKey({ ...base, search: 'smith' })).not.toBe(
      bookingQueryKey({ ...base, search: 'jones' })
    )
  })

  it('rejects an invalid event code', () => {
    expect(() =>
      normalizeBookingQuery({ ...base, eventCode: 'NOPE' as 'CADCNX' })
    ).toThrow(/Invalid event code/)
  })

  it('keeps export page sizes above the dashboard cap', () => {
    expect(
      normalizeBookingQuery({ ...base, pageSize: 10_000 }, 10_000).pageSize
    ).toBe(10_000)
    expect(normalizeBookingQuery({ ...base, pageSize: 10_000 }).pageSize).toBe(
      100
    )
  })
})
