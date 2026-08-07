import { describe, expect, it } from 'vitest'
import { computeBookingRefundFields } from './refund-fields'

const NOW = '2026-08-07T12:00:00.000Z'

describe('computeBookingRefundFields', () => {
  it('keeps amount_refunded at 0 when order is cancelled with no SKU money', () => {
    const result = computeBookingRefundFields(2500, undefined, 'cancelled', NOW)

    expect(result.amount_refunded).toBe(0)
    expect(result.amount_net).toBe(2500)
    expect(result.refund_status).toBe('full')
    expect(result.is_cancelled).toBe(true)
    expect(result.cancel_source).toBe('woo')
    expect(result.cancelled_at).toBe(NOW)
    expect(result.refunded_at).toBeNull()
    expect(result.woo_status).toBe('cancelled')
  })

  it('keeps amount_refunded at 0 when order is refunded with no SKU allocation', () => {
    const result = computeBookingRefundFields(1800, undefined, 'refunded', NOW)

    expect(result.amount_refunded).toBe(0)
    expect(result.amount_net).toBe(1800)
    expect(result.refund_status).toBe('full')
    expect(result.is_cancelled).toBe(true)
  })

  it('marks partial refund when SKU money is below line total', () => {
    const result = computeBookingRefundFields(
      2000,
      { refunded: 500, latestAt: '2026-08-01T10:00:00.000Z' },
      'completed',
      NOW
    )

    expect(result.amount_refunded).toBe(500)
    expect(result.amount_net).toBe(1500)
    expect(result.refund_status).toBe('partial')
    expect(result.is_cancelled).toBe(true)
    expect(result.refunded_at).toBe('2026-08-01T10:00:00.000Z')
    expect(result.cancelled_at).toBe('2026-08-01T10:00:00.000Z')
  })

  it('marks full refund when SKU money covers the line total (within 0.009)', () => {
    const result = computeBookingRefundFields(
      1000,
      { refunded: 999.995, latestAt: '2026-08-02T00:00:00.000Z' },
      'completed',
      NOW
    )

    expect(result.refund_status).toBe('full')
    expect(result.is_cancelled).toBe(true)
    expect(result.amount_refunded).toBe(999.995)
  })

  it('does not cancel a sibling line when another SKU was refunded (no alloc)', () => {
    const result = computeBookingRefundFields(3000, undefined, 'completed', NOW)

    expect(result.is_cancelled).toBe(false)
    expect(result.refund_status).toBe('none')
    expect(result.amount_refunded).toBe(0)
    expect(result.amount_net).toBe(3000)
    expect(result.cancel_source).toBeNull()
    expect(result.cancelled_at).toBeNull()
  })
})
