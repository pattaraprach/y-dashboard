import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BOOKING_PAGE_SIZE,
  BOOKING_SELECT,
  eventSkuFilter,
} from '@/lib/bookings-query'
import {
  rshPickupHeadcount,
  ticketGuestCount,
} from '@/lib/child-count'
import { buildHourlyMetrics } from '@/lib/hourly-metrics'
import { createServiceClient } from '@/lib/supabase-admin'
import type {
  BookingWithAttendees,
  DailyMetrics,
  DashboardMetrics,
  EventMetrics,
  HourlyMetrics,
  MonthlySummary,
} from '@/types/database'

export type EventCode = 'CADCNX' | 'CADNYE'

export interface DashboardSnapshot {
  eventCode: EventCode
  generatedAt: string
  bookings: BookingWithAttendees[]
  availableEventDates: string[]
  metrics: DashboardMetrics
  eventMetrics: EventMetrics[]
  dailyMetrics: DailyMetrics[]
  hourlyMetrics: HourlyMetrics[]
  monthlySummary: MonthlySummary[]
}

export function dashboardCacheTag(eventCode: EventCode): string {
  return `dashboard:${eventCode}`
}

async function fetchEventBookings(
  eventCode: EventCode,
  supabase: SupabaseClient
): Promise<BookingWithAttendees[]> {
  const rows: BookingWithAttendees[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('cad_yip_bookings')
      .select(BOOKING_SELECT)
      .ilike('sku', eventSkuFilter(eventCode))
      .order('woo_id', { ascending: false })
      .range(offset, offset + BOOKING_PAGE_SIZE - 1)

    if (error) throw error

    const batch = (data ?? []) as unknown as BookingWithAttendees[]
    rows.push(...batch)
    hasMore = batch.length === BOOKING_PAGE_SIZE
    offset += BOOKING_PAGE_SIZE
  }

  return rows
}

/** Sales period timestamp: Woo order time, not Supabase insert time. */
function salesTimestamp(booking: {
  order_created_at?: string | null
  created_at?: string | null
}): string | null {
  return booking.order_created_at || booking.created_at || null
}

function buildMetrics(bookings: BookingWithAttendees[]): {
  metrics: DashboardMetrics
  eventMetrics: EventMetrics[]
  dailyMetrics: DailyMetrics[]
  hourlyMetrics: HourlyMetrics[]
  monthlySummary: MonthlySummary[]
  availableEventDates: string[]
} {
  const activeBookings = bookings.filter((b) => !b.is_cancelled)

  // Ticket guests = named attendees only (children free → excluded).
  // RSH pickup headcount = attendees + child_count (capacity).
  const ticketGuestsByBooking = new Map<number, number>()
  for (const b of bookings) {
    ticketGuestsByBooking.set(b.id, ticketGuestCount(b))
  }

  const totalOrders = activeBookings.length
  const totalGuests = activeBookings.reduce(
    (sum, b) => sum + (ticketGuestsByBooking.get(b.id) || 0),
    0
  )
  const totalAmount = activeBookings.reduce((sum, b) => sum + Number(b.amount), 0)
  const totalCommission = activeBookings.reduce(
    (sum, b) => sum + Number(b.commission),
    0
  )
  const totalFees = activeBookings.reduce((sum, b) => sum + Number(b.fees), 0)
  const totalProfit = totalCommission - totalFees
  const estimatedProfitAfterVAT = totalProfit * 0.93

  const rshAttendees = activeBookings
    .filter((b) => b.is_rsh_transfer)
    .reduce((sum, b) => sum + rshPickupHeadcount(b), 0)

  const rshByDayMap = new Map<string, number>()
  for (const b of activeBookings) {
    if (!b.is_rsh_transfer) continue
    const day = b.event_date || 'Unknown'
    rshByDayMap.set(day, (rshByDayMap.get(day) || 0) + rshPickupHeadcount(b))
  }
  const rshAttendeesByDay = Array.from(rshByDayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const metrics: DashboardMetrics = {
    totalOrders,
    totalGuests,
    totalAmount,
    totalCommission,
    totalFees,
    totalProfit,
    estimatedProfitAfterVAT,
    rshAttendees,
    rshAttendeesByDay,
  }

  const eventMap = new Map<
    string,
    { guests: number; orders: number; amount: number; commission: number }
  >()
  for (const booking of activeBookings) {
    const eventType = booking.event_type || 'Unknown'
    const current = eventMap.get(eventType) || {
      guests: 0,
      orders: 0,
      amount: 0,
      commission: 0,
    }
    eventMap.set(eventType, {
      guests: current.guests + (ticketGuestsByBooking.get(booking.id) || 0),
      orders: current.orders + 1,
      amount: current.amount + Number(booking.amount),
      commission: current.commission + Number(booking.commission),
    })
  }
  const eventMetrics: EventMetrics[] = Array.from(eventMap.entries())
    .map(([eventType, data]) => ({
      eventType,
      totalGuests: data.guests,
      totalOrders: data.orders,
      totalAmount: data.amount,
      totalCommission: data.commission,
    }))
    .sort((a, b) => b.totalGuests - a.totalGuests)

  const dailyMap = new Map<
    string,
    { guests: number; orders: number; rshOrders: number; nonRshOrders: number }
  >()
  for (const booking of activeBookings) {
    const soldAt = salesTimestamp(booking)
    if (!soldAt) continue
    const date = soldAt.split('T')[0]
    const current = dailyMap.get(date) || {
      guests: 0,
      orders: 0,
      rshOrders: 0,
      nonRshOrders: 0,
    }
    const guestCount = ticketGuestsByBooking.get(booking.id) || 0
    const isRsh = booking.is_rsh_transfer
    dailyMap.set(date, {
      guests: current.guests + guestCount,
      orders: current.orders + 1,
      rshOrders: current.rshOrders + (isRsh ? 1 : 0),
      nonRshOrders: current.nonRshOrders + (isRsh ? 0 : 1),
    })
  }
  const dailyMetrics: DailyMetrics[] = Array.from(dailyMap.entries()).map(
    ([date, data]) => ({
      date,
      totalGuests: data.guests,
      totalOrders: data.orders,
      rshGuests: data.rshOrders,
      nonRshGuests: data.nonRshOrders,
    })
  )

  // Snapshot still includes a point-in-time hourly series for API completeness;
  // Dashboard recomputes live via buildHourlyMetrics so 24h chart does not freeze.
  const hourlyMetrics: HourlyMetrics[] = buildHourlyMetrics(bookings)

  const monthlyMap = new Map<
    string,
    Map<
      string,
      Map<
        string,
        {
          sku: string
          eventType: string
          quantity: number
          totalAmount: number
          totalCommission: number
        }
      >
    >
  >()

  for (const booking of activeBookings) {
    const soldAt = salesTimestamp(booking)
    if (!soldAt) continue
    const createdDate = new Date(soldAt)
    const month = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`
    const eventDate = booking.event_date || 'No Event Date'
    const sku = booking.sku || 'Unknown'
    const eventType = booking.event_type || 'Unknown'

    if (!monthlyMap.has(month)) monthlyMap.set(month, new Map())
    const eventDaysMap = monthlyMap.get(month)!
    if (!eventDaysMap.has(eventDate)) eventDaysMap.set(eventDate, new Map())
    const ticketTypesMap = eventDaysMap.get(eventDate)!

    const ticketKey = `${sku}-${eventType}`
    const current = ticketTypesMap.get(ticketKey) || {
      sku,
      eventType,
      quantity: 0,
      totalAmount: 0,
      totalCommission: 0,
    }
    ticketTypesMap.set(ticketKey, {
      sku,
      eventType,
      quantity: current.quantity + 1,
      totalAmount: current.totalAmount + Number(booking.amount),
      totalCommission: current.totalCommission + Number(booking.commission),
    })
  }

  const monthlySummary: MonthlySummary[] = Array.from(monthlyMap.entries())
    .map(([month, eventDaysMap]) => {
      const eventDays = Array.from(eventDaysMap.entries())
        .map(([eventDate, ticketTypesMap]) => {
          const ticketTypes = Array.from(ticketTypesMap.values())
          return {
            eventDate,
            ticketTypes: ticketTypes.sort((a, b) => b.quantity - a.quantity),
            totalOrders: ticketTypes.reduce((sum, t) => sum + t.quantity, 0),
            totalAmount: ticketTypes.reduce((sum, t) => sum + t.totalAmount, 0),
            totalCommission: ticketTypes.reduce(
              (sum, t) => sum + t.totalCommission,
              0
            ),
          }
        })
        .sort(
          (a, b) =>
            new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
        )

      const [year, monthNum] = month.split('-')
      const monthDisplay = new Date(
        parseInt(year, 10),
        parseInt(monthNum, 10) - 1,
        1
      ).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

      return {
        month,
        monthDisplay,
        eventDays,
        totalOrders: eventDays.reduce((sum, d) => sum + d.totalOrders, 0),
        totalAmount: eventDays.reduce((sum, d) => sum + d.totalAmount, 0),
        totalCommission: eventDays.reduce(
          (sum, d) => sum + d.totalCommission,
          0
        ),
      }
    })
    .sort((a, b) => b.month.localeCompare(a.month))

  const availableEventDates = [
    ...new Set(
      bookings
        .map((b) => b.event_date)
        .filter((d): d is string => Boolean(d))
    ),
  ].sort()

  return {
    metrics,
    eventMetrics,
    dailyMetrics,
    hourlyMetrics,
    monthlySummary,
    availableEventDates,
  }
}

/** Uncached build — always hits Supabase. Used by Resync and cache fill. */
export async function buildDashboardSnapshot(
  eventCode: EventCode,
  client?: SupabaseClient
): Promise<DashboardSnapshot> {
  const supabase = client ?? createServiceClient()
  const bookings = await fetchEventBookings(eventCode, supabase)
  const derived = buildMetrics(bookings)

  return {
    eventCode,
    generatedAt: new Date().toISOString(),
    bookings,
    ...derived,
  }
}
