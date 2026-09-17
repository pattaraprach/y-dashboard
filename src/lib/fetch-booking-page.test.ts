import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchBookingPage,
  isBookingPageAbortError,
} from './fetch-booking-page'
import { DEFAULT_BOOKING_QUERY } from './bookings-query'

const query = {
  eventCode: 'CADCNX' as const,
  ...DEFAULT_BOOKING_QUERY,
  search: 'smith',
}

function clientReturning(
  pages: Array<{ data: unknown; error: unknown }>
): SupabaseClient {
  const remaining = [...pages]
  return {
    rpc: () => {
      const page = remaining.shift() ?? {
        data: null,
        error: new Error('unexpected extra rpc'),
      }
      const result = Promise.resolve(page)
      return Object.assign(result, {
        abortSignal: () => result,
      })
    },
  } as unknown as SupabaseClient
}

describe('isBookingPageAbortError', () => {
  it('treats supabase abort payloads as abort, not a failed search', () => {
    expect(
      isBookingPageAbortError({
        message: 'AbortError: The user aborted a request.',
        hint: 'The request was aborted locally via the provided AbortSignal.',
      })
    ).toBe(true)
    expect(isBookingPageAbortError(new Error('timeout'))).toBe(false)
  })
})

describe('fetchBookingPage', () => {
  it('returns the page from the rpc payload', async () => {
    const client = clientReturning([
      {
        data: {
          bookings: [{ id: 1, woo_id: 99 }],
          total: 1,
        },
        error: null,
      },
    ])
    await expect(fetchBookingPage(client, query)).resolves.toMatchObject({
      total: 1,
      pageIndex: 0,
      bookings: [{ id: 1, woo_id: 99 }],
    })
  })

  it('does not throw a search failure when the request was aborted', async () => {
    const client = clientReturning([
      {
        data: null,
        error: {
          message: 'AbortError: The user aborted a request.',
          hint: 'The request was aborted locally via the provided AbortSignal.',
        },
      },
    ])
    await expect(fetchBookingPage(client, query)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('does not cap export page size at the dashboard maximum', async () => {
    const rpc = vi.fn(() => {
      const result = Promise.resolve({
        data: { bookings: [], total: 0 },
        error: null,
      })
      return Object.assign(result, { abortSignal: () => result })
    })
    const client = { rpc } as unknown as SupabaseClient
    await fetchBookingPage(
      client,
      { ...query, pageSize: 10_000 },
      { pageSizeMax: 10_000 }
    )
    expect(rpc).toHaveBeenCalledWith(
      'cad_yip_booking_page',
      expect.objectContaining({ p_page_size: 10_000 })
    )
  })

  it('clamps past-the-end pages instead of returning empty', async () => {
    const client = clientReturning([
      { data: { bookings: [], total: 25 }, error: null },
      {
        data: { bookings: [{ id: 9 }], total: 25 },
        error: null,
      },
    ])
    await expect(
      fetchBookingPage(client, { ...query, pageIndex: 9, pageSize: 25 })
    ).resolves.toMatchObject({
      pageIndex: 0,
      bookings: [{ id: 9 }],
    })
  })
})
