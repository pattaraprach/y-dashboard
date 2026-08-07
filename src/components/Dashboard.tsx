'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import {
  loadDashboardSnapshot,
  resyncDashboardSnapshot,
} from '@/app/actions/dashboard'
import type { DashboardSnapshot } from '@/lib/build-dashboard-snapshot'
import { buildHourlyMetrics } from '@/lib/hourly-metrics'
import {
  buildBookingExportCsv,
  buildGroupedExportText,
  cn,
  downloadCsv,
  formatCurrency,
  formatNumber,
} from '@/lib/utils'
import { EventNav } from '@/components/EventNav'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { EventBreakdown } from '@/components/dashboard/EventBreakdown'
import { DailyChart } from '@/components/dashboard/DailyChart'
import { MonthlySummary } from '@/components/dashboard/MonthlySummary'
import { OrdersTable } from '@/components/orders/OrdersTable'
import { OrderModal } from '@/components/orders/OrderModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type {
  BookingWithAttendees,
  DashboardMetrics,
  EventMetrics,
  DailyMetrics,
  MonthlySummary as MonthlySummaryType,
} from '@/types/database'
import { RefreshCwIcon, SearchIcon, XIcon } from 'lucide-react'

interface DashboardProps {
  eventCode: 'CADCNX' | 'CADNYE'
  eventName: string
}

// Icons as SVG components
const OrdersIcon = () => (
  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const GuestsIcon = () => (
  <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const AmountIcon = () => (
  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CommissionIcon = () => (
  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
  </svg>
)

const FeesIcon = () => (
  <svg className="w-6 h-6 text-warning-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ProfitIcon = () => (
  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
)

const VATIcon = () => (
  <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const RSHIcon = () => (
  <svg className="w-6 h-6 text-warning-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
)

type RshFilter = 'all' | 'rsh' | 'non-rsh'
type StatusFilter = 'active' | 'cancelled' | 'all'

export default function Dashboard({ eventCode, eventName }: DashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [eventMetrics, setEventMetrics] = useState<EventMetrics[]>([])
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryType[]>([])
  const [allBookings, setAllBookings] = useState<BookingWithAttendees[]>([])
  const [selectedBooking, setSelectedBooking] = useState<BookingWithAttendees | null>(null)
  const [availableEventDates, setAvailableEventDates] = useState<string[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isResyncing, setIsResyncing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Search and filter state (client-side on cached snapshot)
  const [searchTerm, setSearchTerm] = useState('')
  const [rshFilter, setRshFilter] = useState<RshFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [eventDateFilter, setEventDateFilter] = useState('')

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setAllBookings(snapshot.bookings)
    setMetrics(snapshot.metrics)
    setEventMetrics(snapshot.eventMetrics)
    setDailyMetrics(snapshot.dailyMetrics)
    setMonthlySummary(snapshot.monthlySummary)
    setAvailableEventDates(snapshot.availableEventDates)
    setGeneratedAt(snapshot.generatedAt)
    setLoadError(null)
  }, [])

  const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

  const loadFromCache = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      applySnapshot(await loadDashboardSnapshot(eventCode))
    } catch (error) {
      console.error('Error loading dashboard snapshot:', error)
      setLoadError(errorMessage(error, 'Failed to load dashboard data'))
    } finally {
      setIsLoading(false)
    }
  }, [eventCode, applySnapshot])

  const handleResync = useCallback(async () => {
    setIsResyncing(true)
    setLoadError(null)
    try {
      applySnapshot(await resyncDashboardSnapshot(eventCode))
    } catch (error) {
      console.error('Error resyncing dashboard:', error)
      setLoadError(errorMessage(error, 'Failed to resync dashboard'))
    } finally {
      setIsResyncing(false)
    }
  }, [eventCode, applySnapshot])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) void loadFromCache()
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [loadFromCache])

  /**
   * Shared filter for table + export.
   * rshOnly: force RSH transfer (for Export RSH); otherwise use transfer filter.
   */
  const filterBookings = useCallback(
    (options?: { rshOnly?: boolean }) => {
      let result = allBookings

      if (statusFilter === 'active') {
        result = result.filter((b) => !b.is_cancelled)
      } else if (statusFilter === 'cancelled') {
        result = result.filter((b) => b.is_cancelled === true)
      }

      if (options?.rshOnly) {
        result = result.filter((b) => b.is_rsh_transfer === true)
      } else if (rshFilter === 'rsh') {
        result = result.filter((b) => b.is_rsh_transfer === true)
      } else if (rshFilter === 'non-rsh') {
        result = result.filter((b) => b.is_rsh_transfer === false)
      }

      if (eventDateFilter) {
        result = result.filter((b) => b.event_date === eventDateFilter)
      }

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase().trim()
        result = result.filter((booking) => {
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
          return searchableFields.some((field) =>
            field.toLowerCase().includes(searchLower)
          )
        })
      }

      // Latest Woo orders first (woo_id is monotonic; created_at is insert time).
      return [...result].sort(
        (a, b) => (b.woo_id ?? 0) - (a.woo_id ?? 0)
      )
    },
    [allBookings, statusFilter, rshFilter, eventDateFilter, searchTerm]
  )

  const filteredBookings = useMemo(() => filterBookings(), [filterBookings])

  const rshExportBookings = useMemo(
    () => filterBookings({ rshOnly: true }),
    [filterBookings]
  )

  // Tick wall clock so rolling 24h buckets advance even when snapshot is static.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Live rolling 24h — never use cached snapshot.hourlyMetrics (freezes under hours TTL).
  const hourlyMetrics = useMemo(
    () => buildHourlyMetrics(allBookings, nowMs),
    [allBookings, nowMs]
  )

  const totalCount = filteredBookings.length

  const clearFilters = () => {
    setSearchTerm('')
    setRshFilter('all')
    setStatusFilter('active')
    setEventDateFilter('')
  }

  const exportStamp = () => new Date().toISOString().slice(0, 10)

  const handleExport = () => {
    if (filteredBookings.length === 0) return
    downloadCsv(
      `${eventCode.toLowerCase()}-bookings-${exportStamp()}.csv`,
      buildBookingExportCsv(filteredBookings)
    )
  }

  const handleExportRsh = () => {
    if (rshExportBookings.length === 0) {
      window.alert('No RSH transfer bookings match the current filters (status / date / search).')
      return
    }
    downloadCsv(
      `${eventCode.toLowerCase()}-rsh-${exportStamp()}.csv`,
      buildBookingExportCsv(rshExportBookings)
    )
  }

  const handleCopyGrouped = async () => {
    if (filteredBookings.length === 0) return
    const text = buildGroupedExportText(filteredBookings)
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const hasActiveFilters =
    searchTerm || rshFilter !== 'all' || statusFilter !== 'active' || eventDateFilter

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
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            {eventName} Dashboard
          </h1>
          <p className="text-muted-foreground">
            Cached event snapshot · filter and export locally after load
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {generatedAt
              ? `Last synced ${new Date(generatedAt).toLocaleString()}`
              : isLoading
                ? 'Loading snapshot…'
                : 'Not synced yet'}
          </p>
          {loadError ? (
            <p className="mt-1 text-sm text-destructive">{loadError}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleResync()}
          disabled={isLoading || isResyncing}
          className="shrink-0"
        >
          {isResyncing ? (
            <>
              <Spinner />
              Resyncing…
            </>
          ) : (
            <>
              <RefreshCwIcon className="size-4" />
              Resync
            </>
          )}
        </Button>
      </header>

      {/* Metrics Grid */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          subtitle="Pickup headcount (adults + children)"
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
      <section className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Orders</h2>
              <p className="text-sm text-muted-foreground">
                {totalCount} matching order{totalCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-80">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search ID, name, email, seat, pickup…"
                  className="pl-8"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyGrouped()}
                  disabled={filteredBookings.length === 0}
                >
                  Copy parties
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleExport}
                  disabled={filteredBookings.length === 0}
                >
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExportRsh}
                  disabled={rshExportBookings.length === 0}
                >
                  Export RSH
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <FilterGroup label="Status">
              {(
                [
                  ['active', 'Active'],
                  ['cancelled', 'Cancelled'],
                  ['all', 'All'],
                ] as const
              ).map(([value, label]) => (
                <FilterButton
                  key={value}
                  active={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </FilterButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Transfer">
              {(
                [
                  ['all', 'All'],
                  ['rsh', 'RSH'],
                  ['non-rsh', 'Non-RSH'],
                ] as const
              ).map(([value, label]) => (
                <FilterButton
                  key={value}
                  active={rshFilter === value}
                  onClick={() => setRshFilter(value)}
                >
                  {label}
                </FilterButton>
              ))}
            </FilterGroup>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Event date</span>
              <select
                value={eventDateFilter}
                onChange={(e) => setEventDateFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">All dates</option>
                {availableEventDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateDisplay(date)}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon className="size-4" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>

        <OrdersTable
          bookings={filteredBookings}
          onRowClick={setSelectedBooking}
          isLoading={isLoading}
        />
      </section>

      <OrderModal
        key={selectedBooking?.id ?? 'closed'}
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onUpdate={() => {
          void handleResync()
        }}
      />
    </div>
  )
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex overflow-hidden rounded-lg border">{children}</div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
