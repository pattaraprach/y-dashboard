import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingWithAttendees } from '@/types/database'
import {
  normalizeBookingQuery,
  type DashboardBookingPage,
  type DashboardBookingQuery,
} from '@/lib/bookings-query'

export function isBookingPageAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (typeof error !== 'object' || error === null) return false
  const record = error as { name?: unknown; message?: unknown; hint?: unknown }
  if (record.name === 'AbortError') return true
  const text = `${String(record.message ?? '')} ${String(record.hint ?? '')}`
  return /aborted/i.test(text)
}

function parseBookingPage(
  data: unknown,
  pageIndex: number
): DashboardBookingPage {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Booking page query returned invalid data.')
  }
  const page = data as { bookings?: BookingWithAttendees[]; total?: number }
  return {
    bookings: Array.isArray(page.bookings) ? page.bookings : [],
    total: Number(page.total) || 0,
    pageIndex,
  }
}

type FetchBookingPageOptions = {
  signal?: AbortSignal
  pageSizeMax?: number
}

async function rpcBookingPage(
  client: SupabaseClient,
  query: DashboardBookingQuery,
  signal?: AbortSignal
): Promise<DashboardBookingPage> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const request = client.rpc('cad_yip_booking_page', {
    p_event_code: query.eventCode,
    p_page_index: query.pageIndex,
    p_page_size: query.pageSize,
    p_status: query.status,
    p_rsh: query.rsh,
    p_event_date: query.eventDate || null,
    p_search: query.search || null,
    p_sort_column: query.sortColumn,
    p_sort_desc: query.sortDesc,
  })
  const { data, error } = await (signal ? request.abortSignal(signal) : request)

  if (signal?.aborted || isBookingPageAbortError(error)) {
    throw new DOMException('Aborted', 'AbortError')
  }
  if (error) throw error
  return parseBookingPage(data, query.pageIndex)
}

export async function fetchBookingPage(
  client: SupabaseClient,
  input: DashboardBookingQuery,
  options?: FetchBookingPageOptions
): Promise<DashboardBookingPage> {
  const query = normalizeBookingQuery(input, options?.pageSizeMax)
  const signal = options?.signal
  const page = await rpcBookingPage(client, query, signal)
  const lastPageIndex = Math.max(0, Math.ceil(page.total / query.pageSize) - 1)
  return query.pageIndex > lastPageIndex
    ? rpcBookingPage(client, { ...query, pageIndex: lastPageIndex }, signal)
    : page
}
