'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { EventNav } from '@/components/EventNav'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { EventBreakdown } from '@/components/dashboard/EventBreakdown'
import { DailyChart } from '@/components/dashboard/DailyChart'
import { MonthlySummary } from '@/components/dashboard/MonthlySummary'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { OrderModal } from '@/components/orders/OrderModal'
import type { Booking, DashboardMetrics, EventMetrics, DailyMetrics, HourlyMetrics, MonthlySummary as MonthlySummaryType } from '@/types/database'

interface DashboardProps {
  eventCode: 'CADCNX' | 'CADNYE'
  eventName: string
}

// Icons as SVG components
const OrdersIcon = () => (
  <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const GuestsIcon = () => (
  <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const AmountIcon = () => (
  <svg className="w-6 h-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CommissionIcon = () => (
  <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
  </svg>
)

const FeesIcon = () => (
  <svg className="w-6 h-6 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ProfitIcon = () => (
  <svg className="w-6 h-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const VATIcon = () => (
  <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const RSHIcon = () => (
  <svg className="w-6 h-6 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
)

const ITEMS_PER_PAGE = 25

type RshFilter = 'all' | 'rsh' | 'non-rsh'

export default function Dashboard({ eventCode, eventName }: DashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [eventMetrics, setEventMetrics] = useState<EventMetrics[]>([])
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([])
  const [hourlyMetrics, setHourlyMetrics] = useState<HourlyMetrics[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryType[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [rshFilter, setRshFilter] = useState<RshFilter>('all')
  const [eventDateFilter, setEventDateFilter] = useState('')
  const [availableEventDates, setAvailableEventDates] = useState<string[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch unique event dates on mount
  useEffect(() => {
    const fetchEventDates = async () => {
      const { data } = await supabase
        .from('cad_yip_bookings')
        .select('event_date')
        .not('event_date', 'is', null)
        .order('event_date', { ascending: true })

      if (data) {
        const uniqueDates = [...new Set(data.map(d => d.event_date).filter(Boolean))] as string[]
        setAvailableEventDates(uniqueDates)
      }
    }
    fetchEventDates()
  }, [])

  const fetchData = useCallback(async () => {
    setIsLoading(true)

    try {
      // Fetch ALL bookings from database in batches
      // Fetch bookings WITH attendees to ensure data consistency
      // Using nested select: *, cad_yip_attendees(id) will return the attendees for each booking

      type BookingWithAttendees = Booking & { cad_yip_attendees: { id: number }[] }
      const allBookings: BookingWithAttendees[] = []
      const BATCH_SIZE = 1000
      let offset = 0
      let hasMore = true

      // Fetch data in batches until we have all records
      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('cad_yip_bookings')
          .select('*, cad_yip_attendees(id)')
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1)

        if (batchError) throw batchError

        const typedBatch = (batchData || []) as BookingWithAttendees[]
        allBookings.push(...typedBatch)

        // If we got fewer records than BATCH_SIZE, we've reached the end
        hasMore = typedBatch.length === BATCH_SIZE
        offset += BATCH_SIZE
      }

      // Filter bookings by event code (SKU contains eventCode)
      const fetchedBookings = allBookings.filter(booking =>
        booking.sku?.toUpperCase().includes(eventCode.toUpperCase())
      )

      setAllBookings(fetchedBookings)

      // Calculate attendees by booking from the nested data
      const attendeesByBooking = new Map<number, number>()
      fetchedBookings.forEach((b) => {
        // Count entries in the nested array
        const count = b.cad_yip_attendees?.length || 0
        attendeesByBooking.set(b.id, count)
      })

      // Calculate aggregated metrics
      const totalOrders = fetchedBookings.length
      const totalGuests = fetchedBookings.reduce((sum, b) => sum + (b.cad_yip_attendees?.length || 0), 0)
      const totalAmount = fetchedBookings.reduce((sum, b) => sum + Number(b.amount), 0)
      const totalCommission = fetchedBookings.reduce((sum, b) => sum + Number(b.commission), 0)
      const totalFees = fetchedBookings.reduce((sum, b) => sum + Number(b.fees), 0)
      const totalProfit = totalCommission - totalFees
      const estimatedProfitAfterVAT = totalProfit * 0.93
      const rshAttendees = fetchedBookings
        .filter(b => b.is_rsh_transfer)
        .reduce((sum, b) => sum + (b.cad_yip_attendees?.length || 0), 0)

      const rshByDayMap = new Map<string, number>()
      fetchedBookings
        .filter(b => b.is_rsh_transfer)
        .forEach(b => {
          const day = b.event_date || 'Unknown'
          rshByDayMap.set(day, (rshByDayMap.get(day) || 0) + (b.cad_yip_attendees?.length || 0))
        })
      const rshAttendeesByDay = Array.from(rshByDayMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setMetrics({
        totalOrders,
        totalGuests,
        totalAmount,
        totalCommission,
        totalFees,
        totalProfit,
        estimatedProfitAfterVAT,
        rshAttendees,
        rshAttendeesByDay,
      })

      // Calculate event metrics
      const eventMap = new Map<string, { guests: number; orders: number; amount: number; commission: number }>()

      fetchedBookings.forEach((booking) => {
        const eventType = booking.event_type || 'Unknown'
        const current = eventMap.get(eventType) || { guests: 0, orders: 0, amount: 0, commission: 0 }
        const guestCount = attendeesByBooking.get(booking.id) || 0
        eventMap.set(eventType, {
          guests: current.guests + guestCount,
          orders: current.orders + 1,
          amount: current.amount + Number(booking.amount),
          commission: current.commission + Number(booking.commission),
        })
      })

      const events: EventMetrics[] = Array.from(eventMap.entries())
        .map(([eventType, data]) => ({
          eventType,
          totalGuests: data.guests,
          totalOrders: data.orders,
          totalAmount: data.amount,
          totalCommission: data.commission,
        }))
        .sort((a, b) => b.totalGuests - a.totalGuests)

      setEventMetrics(events)

      // Calculate daily booking counts by date entered (created_at)
      const dailyMap = new Map<string, { guests: number; orders: number; rshOrders: number; nonRshOrders: number }>()

      fetchedBookings.forEach((booking) => {
        if (!booking.created_at) return
        const date = booking.created_at.split('T')[0]
        const current = dailyMap.get(date) || { guests: 0, orders: 0, rshOrders: 0, nonRshOrders: 0 }
        const guestCount = attendeesByBooking.get(booking.id) || 0
        const isRsh = booking.is_rsh_transfer

        dailyMap.set(date, {
          guests: current.guests + guestCount,
          orders: current.orders + 1,
          rshOrders: current.rshOrders + (isRsh ? 1 : 0),
          nonRshOrders: current.nonRshOrders + (isRsh ? 0 : 1),
        })
      })

      const daily: DailyMetrics[] = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          totalGuests: data.guests,
          totalOrders: data.orders,
          rshGuests: data.rshOrders,
          nonRshGuests: data.nonRshOrders,
        }))

      setDailyMetrics(daily)

      // Compute rolling 24-hour hourly metrics
      const nowTs = Date.now()
      const hourly: HourlyMetrics[] = Array.from({ length: 24 }, (_, i) => {
        const slotStart = nowTs - (24 - i) * 3_600_000
        const slotEnd   = nowTs - (23 - i) * 3_600_000
        const label = new Date(slotStart).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

        let totalOrders = 0, rshOrders = 0, nonRshOrders = 0, totalGuests = 0
        fetchedBookings.forEach(b => {
          if (!b.created_at) return
          const ts = new Date(b.created_at).getTime()
          if (ts >= slotStart && ts < slotEnd) {
            totalOrders++
            if (b.is_rsh_transfer) rshOrders++
            else nonRshOrders++
            totalGuests += attendeesByBooking.get(b.id) || 0
          }
        })

        return { label, totalOrders, rshOrders, nonRshOrders, totalGuests }
      })
      setHourlyMetrics(hourly)

      // Calculate monthly summary
      // Group bookings by month (based on created_at) and event date
      const monthlyMap = new Map<string, Map<string, Map<string, { sku: string; eventType: string; quantity: number; totalAmount: number; totalCommission: number }>>>()

      fetchedBookings.forEach((booking) => {
        if (!booking.created_at) return

        // Use created_at to determine the month
        const createdDate = new Date(booking.created_at)
        const month = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`

        // Still track event_date within each month (use placeholder if missing)
        const eventDate = booking.event_date || 'No Event Date'
        const sku = booking.sku || 'Unknown'
        const eventType = booking.event_type || 'Unknown'

        // Get or create month map
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, new Map())
        }
        const eventDaysMap = monthlyMap.get(month)!

        // Get or create event day map
        if (!eventDaysMap.has(eventDate)) {
          eventDaysMap.set(eventDate, new Map())
        }
        const ticketTypesMap = eventDaysMap.get(eventDate)!

        // Get or create ticket type entry
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
      })

      // Convert to array format
      const monthlySummaryData: MonthlySummaryType[] = Array.from(monthlyMap.entries())
        .map(([month, eventDaysMap]) => {
          const eventDays = Array.from(eventDaysMap.entries())
            .map(([eventDate, ticketTypesMap]) => {
              const ticketTypes = Array.from(ticketTypesMap.values())
              const totalOrders = ticketTypes.reduce((sum, t) => sum + t.quantity, 0)
              const totalAmount = ticketTypes.reduce((sum, t) => sum + t.totalAmount, 0)
              const totalCommission = ticketTypes.reduce((sum, t) => sum + t.totalCommission, 0)

              return {
                eventDate,
                ticketTypes: ticketTypes.sort((a, b) => b.quantity - a.quantity),
                totalOrders,
                totalAmount,
                totalCommission,
              }
            })
            .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())

          const totalOrders = eventDays.reduce((sum, d) => sum + d.totalOrders, 0)
          const totalAmount = eventDays.reduce((sum, d) => sum + d.totalAmount, 0)
          const totalCommission = eventDays.reduce((sum, d) => sum + d.totalCommission, 0)

          const [year, monthNum] = month.split('-')
          const monthDisplay = new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          })

          return {
            month,
            monthDisplay,
            eventDays,
            totalOrders,
            totalAmount,
            totalCommission,
          }
        })
        .sort((a, b) => b.month.localeCompare(a.month)) // Sort by month descending (newest first)

      setMonthlySummary(monthlySummaryData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [eventCode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Client-side filtering - filter bookings based on all criteria
  const filteredBookings = useMemo(() => {
    let result = allBookings

    // Apply RSH Transfer filter
    if (rshFilter === 'rsh') {
      result = result.filter(b => b.is_rsh_transfer === true)
    } else if (rshFilter === 'non-rsh') {
      result = result.filter(b => b.is_rsh_transfer === false)
    }

    // Apply Event Date filter
    if (eventDateFilter) {
      result = result.filter(b => b.event_date === eventDateFilter)
    }

    // Apply search filter (client-side full-text search)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim()
      result = result.filter(booking => {
        const searchableFields = [
          booking.woo_id?.toString() || '',
          booking.firstname || '',
          booking.lastname || '',
          booking.email || '',
          booking.seat || '',
          booking.pickup_loc || '',
          booking.event_date || '',
          booking.zone_code || '',
          booking.zone || '',
        ]
        return searchableFields.some(field =>
          field.toLowerCase().includes(searchLower)
        )
      })
    }

    return result
  }, [allBookings, rshFilter, eventDateFilter, searchTerm])

  // Paginate the filtered results
  const totalCount = filteredBookings.length
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredBookings.slice(startIndex, endIndex)
  }, [filteredBookings, currentPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [rshFilter, eventDateFilter, searchTerm])

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setRshFilter('all')
    setEventDateFilter('')
    setCurrentPage(1)
  }

  const hasActiveFilters = searchTerm || rshFilter !== 'all' || eventDateFilter

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Event Navigation */}
      <EventNav />

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          {eventName} Dashboard
        </h1>
        <p className="text-[var(--foreground-secondary)]">
          Real-time booking analytics and management
        </p>
      </header>

      {/* Metrics Grid */}
      <section className="dashboard-grid mb-8">
        <MetricCard
          title="Total Orders"
          value={metrics ? formatNumber(metrics.totalOrders) : '—'}
          icon={<OrdersIcon />}
          variant="default"
        />
        <MetricCard
          title="Total Guests"
          value={metrics ? formatNumber(metrics.totalGuests) : '—'}
          icon={<GuestsIcon />}
          variant="accent"
        />
        <MetricCard
          title="Total Amount"
          value={metrics ? formatCurrency(metrics.totalAmount) : '—'}
          icon={<AmountIcon />}
          variant="success"
        />
        <MetricCard
          title="Total Commission"
          value={metrics ? formatCurrency(metrics.totalCommission) : '—'}
          icon={<CommissionIcon />}
          variant="default"
        />
        <MetricCard
          title="Total Fees"
          value={metrics ? formatCurrency(metrics.totalFees) : '—'}
          icon={<FeesIcon />}
          variant="warning"
        />
        <MetricCard
          title="Total Profit"
          value={metrics ? formatCurrency(metrics.totalProfit) : '—'}
          subtitle="Commission - Fees"
          icon={<ProfitIcon />}
          variant="success"
        />
        <MetricCard
          title="Est. Profit after VAT"
          value={metrics ? formatCurrency(metrics.estimatedProfitAfterVAT) : '—'}
          subtitle="After 7% VAT deduction"
          icon={<VATIcon />}
          variant="accent"
        />
        <MetricCard
          title="RSH Transfer Attendees"
          value={metrics ? formatNumber(metrics.rshAttendees) : '—'}
          subtitle="Total attendees via RSH transfer"
          icon={<RSHIcon />}
          variant="warning"
          breakdown={metrics?.rshAttendeesByDay.map(d => ({
            label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: formatNumber(d.count),
          }))}
        />
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <EventBreakdown events={eventMetrics} isLoading={isLoading} />
        <DailyChart data={dailyMetrics} hourlyData={hourlyMetrics} isLoading={isLoading} />
      </section>

      {/* Monthly Summary Section */}
      <section className="mb-8">
        <MonthlySummary data={monthlySummary} isLoading={isLoading} />
      </section>

      {/* Orders Section */}
      <section>
        <div className="flex flex-col gap-4 mb-6">
          {/* Title and Search Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Orders
            </h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by ID, name, email, seat, pickup, date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full sm:w-96"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* RSH Transfer Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--foreground-secondary)]">Transfer:</span>
              <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
                <button
                  onClick={() => setRshFilter('all')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${rshFilter === 'all'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]'
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRshFilter('rsh')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border-x border-[var(--border)] ${rshFilter === 'rsh'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]'
                    }`}
                >
                  RSH Only
                </button>
                <button
                  onClick={() => setRshFilter('non-rsh')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${rshFilter === 'non-rsh'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]'
                    }`}
                >
                  Non-RSH
                </button>
              </div>
            </div>

            {/* Event Date Filter - Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--foreground-secondary)]">Event Date:</span>
              <select
                value={eventDateFilter}
                onChange={(e) => setEventDateFilter(e.target.value)}
                className="input py-1.5 text-sm min-w-[180px]"
              >
                <option value="">All Dates</option>
                {availableEventDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateDisplay(date)}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[var(--warning)] hover:text-[var(--warning-hover)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters
              </button>
            )}

            {/* Results Count */}
            <div className="ml-auto text-sm text-[var(--foreground-secondary)]">
              Showing {paginatedBookings.length} of {totalCount} orders
            </div>
          </div>
        </div>

        <OrdersTable
          bookings={paginatedBookings}
          onRowClick={setSelectedBooking}
          isLoading={isLoading}
        />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {/* Page number buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${currentPage === pageNum
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)]'
                      }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--background-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        )}
      </section>

      {/* Order Modal */}
      {selectedBooking && (
        <OrderModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  )
}
