/**
 * Shared Supabase query helpers for dashboard bookings.
 * Keep selects lean and always filter event code on the server.
 */

import type { BookingWithAttendees } from '@/types/database'

export type BookingStatusFilter = 'active' | 'cancelled' | 'all'
export type BookingRshFilter = 'all' | 'rsh' | 'non-rsh'

export interface DashboardBookingQuery {
  eventCode: 'CADCNX' | 'CADNYE'
  pageIndex: number
  pageSize: number
  status: BookingStatusFilter
  rsh: BookingRshFilter
  eventDate: string
  search: string
}

export interface DashboardBookingPage {
  bookings: BookingWithAttendees[]
  total: number
}

export const DEFAULT_BOOKING_QUERY = {
  pageIndex: 0,
  pageSize: 25,
  status: 'active',
  rsh: 'all',
  eventDate: '',
  search: '',
} as const

export const BOOKING_EXPORT_PAGE_SIZE = 10_000
