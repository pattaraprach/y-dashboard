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
