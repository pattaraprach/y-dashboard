/**
 * Pure Woo refund → booking field mapping (shared by sync + tests).
 * No I/O, no Supabase.
 */

export type RefundStatus = 'none' | 'partial' | 'full'

export type SkuRefundAlloc = {
  refunded: number
  latestAt: string | null
}

export type BookingRefundFields = {
  amount_refunded: number
  amount_net: number
  refund_status: RefundStatus
  is_cancelled: boolean
  cancel_source: 'woo' | null
  cancelled_at: string | null
  refunded_at: string | null
  woo_status: string
}

/**
 * Map line total + optional SKU refund allocation + order status → booking columns.
 *
 * - Monetary refund on the SKU → partial/full + cancelled
 * - Order status refunded/cancelled with no money on this SKU → cancelled, refund_status full,
 *   but amount_refunded stays 0 (do not invent money)
 * - Partial refund on another SKU alone does not cancel this line
 */
export function computeBookingRefundFields(
  lineTotal: number,
  alloc: SkuRefundAlloc | undefined,
  orderStatus: string,
  nowIso: string = new Date().toISOString()
): BookingRefundFields {
  const amount_refunded = alloc?.refunded ?? 0
  let refund_status: RefundStatus = 'none'
  let is_cancelled = false

  if (amount_refunded > 0) {
    refund_status = amount_refunded + 0.009 >= lineTotal ? 'full' : 'partial'
    is_cancelled = true
  } else if (orderStatus === 'refunded' || orderStatus === 'cancelled') {
    refund_status = 'full'
    is_cancelled = true
  }

  const amount_net = Math.max(0, lineTotal - amount_refunded)
  const refunded_at = alloc?.latestAt ?? null
  const cancelled_at = is_cancelled ? refunded_at || nowIso : null

  return {
    amount_refunded,
    amount_net,
    refund_status,
    is_cancelled,
    cancel_source: is_cancelled ? 'woo' : null,
    cancelled_at,
    refunded_at,
    woo_status: orderStatus,
  }
}
