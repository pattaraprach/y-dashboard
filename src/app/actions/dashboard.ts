'use server'

import { updateTag } from 'next/cache'
import {
  buildDashboardSnapshot,
  dashboardCacheTag,
  type DashboardSnapshot,
  type EventCode,
} from '@/lib/build-dashboard-snapshot'
import { getCachedDashboardSnapshot } from '@/lib/get-dashboard-snapshot'
import {
  BOOKING_EXPORT_PAGE_SIZE,
  DASHBOARD_BOOKING_PAGE_SIZE_MAX,
  DASHBOARD_BOOKING_SORT_COLUMNS,
  type DashboardBookingPage,
  type DashboardBookingQuery,
} from '@/lib/bookings-query'
import { createServiceClient, hasServiceRoleKey } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { AttendeeName, BookingWithAttendees } from '@/types/database'
import { buildBookingExportCsv, buildGroupedExportText } from '@/lib/utils'

const FRESH_SNAPSHOT_DEDUPE_MS = 750
const freshSnapshotResults = new Map<
  EventCode,
  { snapshot: DashboardSnapshot; expiresAt: number }
>()
const freshSnapshotLoads = new Map<EventCode, Promise<DashboardSnapshot>>()

function assertEventCode(code: string): EventCode {
  if (code !== 'CADCNX' && code !== 'CADNYE') {
    throw new Error(`Invalid event code: ${code}`)
  }
  return code
}

/** Require a signed-in user before any dashboard data path (including service-role cache). */
async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) {
    throw new Error('Unauthorized')
  }
  return supabase
}

function normalizeBookingQuery(input: DashboardBookingQuery): DashboardBookingQuery {
  return {
    eventCode: assertEventCode(input.eventCode),
    pageIndex: Math.max(0, Math.floor(Number(input.pageIndex) || 0)),
    pageSize: Math.min(
      DASHBOARD_BOOKING_PAGE_SIZE_MAX,
      Math.max(1, Math.floor(Number(input.pageSize) || 25))
    ),
    status: ['active', 'cancelled', 'all'].includes(input.status)
      ? input.status
      : 'active',
    rsh: ['all', 'rsh', 'non-rsh'].includes(input.rsh) ? input.rsh : 'all',
    eventDate: typeof input.eventDate === 'string' ? input.eventDate.trim() : '',
    search: typeof input.search === 'string' ? input.search.trim().slice(0, 100) : '',
    sortColumn: DASHBOARD_BOOKING_SORT_COLUMNS.includes(input.sortColumn)
      ? input.sortColumn
      : 'woo_id',
    sortDesc: input.sortDesc !== false,
  }
}

async function fetchBookingPage(
  query: DashboardBookingQuery,
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<DashboardBookingPage> {
  const { data, error } = await client.rpc('cad_yip_booking_page', {
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

  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Booking page query returned invalid data.')
  }

  const page = data as { bookings?: BookingWithAttendees[]; total?: number }
  return {
    bookings: Array.isArray(page.bookings) ? page.bookings : [],
    total: Number(page.total) || 0,
    pageIndex: query.pageIndex,
  }
}

async function loadFreshServiceDashboardSnapshot(
  eventCode: EventCode
): Promise<DashboardSnapshot> {
  const cached = freshSnapshotResults.get(eventCode)
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot

  const inFlight = freshSnapshotLoads.get(eventCode)
  if (inFlight) return inFlight

  const load = buildDashboardSnapshot(eventCode, createServiceClient())
    .then((snapshot) => {
      freshSnapshotResults.set(eventCode, {
        snapshot,
        expiresAt: Date.now() + FRESH_SNAPSHOT_DEDUPE_MS,
      })
      return snapshot
    })
    .finally(() => {
      freshSnapshotLoads.delete(eventCode)
    })
  freshSnapshotLoads.set(eventCode, load)
  return load
}

/** Load snapshot — shared server cache when service role is set; else live user session. */
export async function loadDashboardSnapshot(
  eventCode: string
): Promise<DashboardSnapshot> {
  await requireAuthenticatedUser()
  const code = assertEventCode(eventCode)

  if (hasServiceRoleKey()) {
    return getCachedDashboardSnapshot(code)
  }

  // No SUPABASE_SERVICE_KEY: fetch with the signed-in user (uncached).
  const supabase = await createSupabaseServerClient()
  return buildDashboardSnapshot(code, supabase)
}

/**
 * Force-refresh. With service role: invalidate tag + rebuild cache.
 * Without: live rebuild via user session.
 */
export async function resyncDashboardSnapshot(
  eventCode: string
): Promise<DashboardSnapshot> {
  await requireAuthenticatedUser()
  const code = assertEventCode(eventCode)

  if (hasServiceRoleKey()) {
    updateTag(dashboardCacheTag(code))
    freshSnapshotResults.delete(code)
    return buildDashboardSnapshot(code)
  }

  const supabase = await createSupabaseServerClient()
  return buildDashboardSnapshot(code, supabase)
}

/** Live aggregate read without evicting the shared SSR cache. */
export async function loadFreshDashboardSnapshot(
  eventCode: string
): Promise<DashboardSnapshot> {
  const userClient = await requireAuthenticatedUser()
  const code = assertEventCode(eventCode)
  return hasServiceRoleKey()
    ? loadFreshServiceDashboardSnapshot(code)
    : buildDashboardSnapshot(code, userClient)
}

export async function loadDashboardBookingsPage(
  input: DashboardBookingQuery
): Promise<DashboardBookingPage> {
  const userClient = await requireAuthenticatedUser()
  const query = normalizeBookingQuery(input)
  const client = hasServiceRoleKey() ? createServiceClient() : userClient
  const page = await fetchBookingPage(query, client)
  const lastPageIndex = Math.max(0, Math.ceil(page.total / query.pageSize) - 1)
  return query.pageIndex > lastPageIndex
    ? fetchBookingPage({ ...query, pageIndex: lastPageIndex }, client)
    : page
}

export async function loadDashboardBookingExport(
  input: DashboardBookingQuery,
  format: 'csv' | 'grouped'
): Promise<string> {
  if (format !== 'csv' && format !== 'grouped') {
    throw new Error('Invalid export format.')
  }
  const userClient = await requireAuthenticatedUser()
  const base = normalizeBookingQuery(input)
  const client = hasServiceRoleKey() ? createServiceClient() : userClient
  const countPage = await fetchBookingPage(
    { ...base, pageIndex: 0, pageSize: 1 },
    client
  )
  if (countPage.total > BOOKING_EXPORT_PAGE_SIZE) {
    throw new Error(`Export exceeds ${BOOKING_EXPORT_PAGE_SIZE} bookings.`)
  }
  const exportPage =
    countPage.total <= 1
      ? countPage
      : await fetchBookingPage(
          { ...base, pageIndex: 0, pageSize: BOOKING_EXPORT_PAGE_SIZE },
          client
        )
  if (exportPage.total > BOOKING_EXPORT_PAGE_SIZE) {
    throw new Error(`Export exceeds ${BOOKING_EXPORT_PAGE_SIZE} bookings.`)
  }
  const bookings = exportPage.bookings

  const attendees = new Map<number, AttendeeName[]>()
  const ids = bookings.map((booking) => booking.id)
  const chunks = Array.from(
    { length: Math.ceil(ids.length / 500) },
    (_, index) => ids.slice(index * 500, (index + 1) * 500)
  )

  for (const bookingIds of chunks) {
    for (let from = 0; ; from += 1_000) {
      const { data, error } = await client
        .from('cad_yip_attendees')
        .select('id, booking_id, attendee_firstname, attendee_lastname')
        .in('booking_id', bookingIds)
        .order('id')
        .range(from, from + 999)
      if (error) throw error
      for (const attendee of data ?? []) {
        const party = attendees.get(attendee.booking_id) ?? []
        party.push(attendee)
        attendees.set(attendee.booking_id, party)
      }
      if ((data?.length ?? 0) < 1_000) break
    }
  }

  const exportBookings: BookingWithAttendees[] = bookings.map((booking) => ({
    ...booking,
    cad_yip_attendees: attendees.get(booking.id) ?? [],
  }))
  return format === 'csv'
    ? buildBookingExportCsv(exportBookings)
    : buildGroupedExportText(exportBookings)
}
