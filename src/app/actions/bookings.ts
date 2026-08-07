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

/**
 * Allowlisted seat/pickup update only — never open-ended column updates from the client.
 */
export async function updateBookingOpsFields(input: {
  bookingId: number
  seat: string
  pickupLoc: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await requireAuthenticatedUser()
    const { error } = await supabase
      .from('cad_yip_bookings')
      .update({
        seat: input.seat,
        pickup_loc: input.pickupLoc,
      })
      .eq('id', input.bookingId)

    if (error) {
      console.error('updateBookingOpsFields:', error)
      return { ok: false, error: 'Failed to save changes.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Unauthorized' }
  }
}

/**
 * Allowlisted cancel/restore only. Restore blocked when Woo refund evidence remains.
 */
export async function setBookingCancelled(input: {
  bookingId: number
  cancelled: boolean
}): Promise<{ ok: true; is_cancelled: boolean } | { ok: false; error: string }> {
  try {
    const supabase = await requireAuthenticatedUser()

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
          cancel_source: 'dashboard',
          cancelled_at: new Date().toISOString(),
        }
      : {
          is_cancelled: false,
          cancel_source: null,
          cancelled_at: null,
        }

    const { error } = await supabase
      .from('cad_yip_bookings')
      .update(payload)
      .eq('id', input.bookingId)

    if (error) {
      console.error('setBookingCancelled:', error)
      return { ok: false, error: 'Failed to update cancel status.' }
    }

    return { ok: true, is_cancelled: input.cancelled }
  } catch {
    return { ok: false, error: 'Unauthorized' }
  }
}
