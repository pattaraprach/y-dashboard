'use server'

import { createSupabaseServerClient } from '@/lib/supabase-server'

async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) {
    throw new Error('Unauthorized')
  }
  return supabase
}

function actionError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message === 'Unauthorized') return 'Unauthorized'
  console.error(fallback, err)
  return fallback
}

/**
 * Allowlisted seat/pickup/child_count update only — never open-ended column updates.
 * child_count is for RSH pickup capacity (children free on ticket).
 */
export async function updateBookingOpsFields(input: {
  bookingId: number
  seat: string
  pickupLoc: string
  childCount: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await requireAuthenticatedUser()

    const childCount = Math.max(
      0,
      Math.min(50, Math.floor(Number(input.childCount) || 0))
    )

    const { data, error } = await supabase
      .from('cad_yip_bookings')
      .update({
        seat: input.seat,
        pickup_loc: input.pickupLoc,
        child_count: childCount,
      })
      .eq('id', input.bookingId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('updateBookingOpsFields:', error)
      return { ok: false, error: 'Failed to save changes.' }
    }
    if (!data) {
      return { ok: false, error: 'Booking not found.' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: actionError(err, 'Failed to save changes.') }
  }
}

/**
 * Allowlisted cancel/restore only. Restore blocked when Woo refund evidence remains.
 * Re-reads refund_status after update to reduce races with concurrent Woo sync.
 */
export async function setBookingCancelled(input: {
  bookingId: number
  cancelled: boolean
}): Promise<{ ok: true; is_cancelled: boolean } | { ok: false; error: string }> {
  try {
    const supabase = await requireAuthenticatedUser()

    if (typeof input.cancelled !== 'boolean') {
      return { ok: false, error: 'Invalid cancel flag.' }
    }

    const { data: row, error: readError } = await supabase
      .from('cad_yip_bookings')
      .select('id, is_cancelled, refund_status')
      .eq('id', input.bookingId)
      .single()

    if (readError || !row) {
      return { ok: false, error: 'Booking not found.' }
    }

    if (
      !input.cancelled &&
      row.refund_status &&
      row.refund_status !== 'none'
    ) {
      return {
        ok: false,
        error: 'This booking still has Woo refund evidence and stays cancelled.',
      }
    }

    const payload = input.cancelled
      ? {
          is_cancelled: true,
          cancel_source: 'dashboard' as const,
          cancelled_at: new Date().toISOString(),
        }
      : {
          is_cancelled: false,
          cancel_source: null,
          cancelled_at: null,
        }

    const { data: updated, error } = await supabase
      .from('cad_yip_bookings')
      .update(payload)
      .eq('id', input.bookingId)
      .select('id, is_cancelled, refund_status')
      .maybeSingle()

    if (error) {
      console.error('setBookingCancelled:', error)
      return { ok: false, error: 'Failed to update cancel status.' }
    }
    if (!updated) {
      return { ok: false, error: 'Booking not found.' }
    }

    // Concurrent Woo sync may have written refund evidence between read and write.
    if (
      !input.cancelled &&
      updated.refund_status &&
      updated.refund_status !== 'none'
    ) {
      await supabase
        .from('cad_yip_bookings')
        .update({
          is_cancelled: true,
          cancel_source: 'woo',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId)
      return {
        ok: false,
        error: 'This booking still has Woo refund evidence and stays cancelled.',
      }
    }

    return { ok: true, is_cancelled: updated.is_cancelled }
  } catch (err) {
    return {
      ok: false,
      error: actionError(err, 'Failed to update cancel status.'),
    }
  }
}
