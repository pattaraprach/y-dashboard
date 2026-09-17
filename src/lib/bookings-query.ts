/**
 * Shared Supabase query helpers for dashboard bookings.
 * Keep selects lean and always filter event code on the server.
 */

import type { BookingWithAttendees } from '@/types/database'

export type BookingStatusFilter = 'active' | 'cancelled' | 'all'
export type BookingRshFilter = 'all' | 'rsh' | 'non-rsh'
export const DASHBOARD_BOOKING_SORT_COLUMNS = [
  'woo_id',
  'name',
  'email',
  'event_date',
  'zone_code',
  'amount',
  'seat',
  'pickup_loc',
  'order_created_at',
] as const
export type DashboardBookingSortColumn =
  (typeof DASHBOARD_BOOKING_SORT_COLUMNS)[number]

export interface DashboardBookingQuery {
  eventCode: 'CADCNX' | 'CADNYE'
  pageIndex: number
  pageSize: number
  status: BookingStatusFilter
  rsh: BookingRshFilter
  eventDate: string
  search: string
  sortColumn: DashboardBookingSortColumn
  sortDesc: boolean
}

export interface DashboardBookingPage {
  bookings: BookingWithAttendees[]
  total: number
  pageIndex: number
}

export const DEFAULT_BOOKING_QUERY = {
  pageIndex: 0,
  pageSize: 25,
  status: 'active',
  rsh: 'all',
  eventDate: '',
  search: '',
  sortColumn: 'woo_id',
  sortDesc: true,
} as const

export const BOOKING_EXPORT_PAGE_SIZE = 10_000
export const DASHBOARD_BOOKING_PAGE_SIZE_MAX = 100

export function assertEventCode(
  code: string
): DashboardBookingQuery['eventCode'] {
  if (code !== 'CADCNX' && code !== 'CADNYE') {
    throw new Error(`Invalid event code: ${code}`)
  }
  return code
}

export function normalizeBookingQuery(
  input: DashboardBookingQuery,
  pageSizeMax: number = DASHBOARD_BOOKING_PAGE_SIZE_MAX
): DashboardBookingQuery {
  return {
    eventCode: assertEventCode(input.eventCode),
    pageIndex: Math.max(0, Math.floor(Number(input.pageIndex) || 0)),
    pageSize: Math.min(
      pageSizeMax,
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

export function bookingQueryKey(query: DashboardBookingQuery): string {
  return JSON.stringify(normalizeBookingQuery(query))
}
