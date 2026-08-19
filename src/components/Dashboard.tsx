'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import {
  loadDashboardBookingsPage,
  loadDashboardExportBookings,
  loadFreshDashboardSnapshot,
  loadDashboardSnapshot,
  resyncDashboardSnapshot,
} from '@/app/actions/dashboard'
import type { DashboardSnapshot } from '@/lib/build-dashboard-snapshot'
import { applyBookingOpsPatch } from '@/lib/dashboard-booking-patch'
import type {
  DashboardBookingPage,
  DashboardBookingQuery,
} from '@/lib/bookings-query'
import { getSupabaseBrowserClient } from '@/lib/supabase'
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
  BookingOpsPatch,
  DashboardMetrics,
  EventMetrics,
  DailyMetrics,
  MonthlySummary as MonthlySummaryType,
  HourlyMetrics,
} from '@/types/database'
import { RefreshCwIcon, SearchIcon, XIcon } from 'lucide-react'
import type { PaginationState } from '@tanstack/react-table'

interface DashboardProps {
  eventCode: 'CADCNX' | 'CADNYE'
  eventName: string
  initialSnapshot: DashboardSnapshot
  initialBookingPage: DashboardBookingPage
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

export default function Dashboard({
  eventCode,
  eventName,
  initialSnapshot,
  initialBookingPage,
}: DashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(
    initialSnapshot.metrics
  )
  const [eventMetrics, setEventMetrics] = useState<EventMetrics[]>(
    initialSnapshot.eventMetrics
  )
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>(
    initialSnapshot.dailyMetrics
  )
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryType[]>(
    initialSnapshot.monthlySummary
  )
  const [allBookings, setAllBookings] = useState<BookingWithAttendees[]>(
    initialBookingPage.bookings
  )
  const [bookingTotal, setBookingTotal] = useState(initialBookingPage.total)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithAttendees | null>(null)
  const [availableEventDates, setAvailableEventDates] = useState<string[]>(
    initialSnapshot.availableEventDates
  )
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    initialSnapshot.generatedAt
  )
  const [hourlySnapshot, setHourlySnapshot] = useState<HourlyMetrics[]>(
    initialSnapshot.hourlyMetrics
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isBookingsLoading, setIsBookingsLoading] = useState(false)
  const [isResyncing, setIsResyncing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Search and filters are sent to the paginated server query.
  const [searchTerm, setSearchTerm] = useState('')
  const [rshFilter, setRshFilter] = useState<RshFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [eventDateFilter, setEventDateFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setMetrics(snapshot.metrics)
    setEventMetrics(snapshot.eventMetrics)
    setDailyMetrics(snapshot.dailyMetrics)
    setMonthlySummary(snapshot.monthlySummary)
    setHourlySnapshot(snapshot.hourlyMetrics)
    setAvailableEventDates(snapshot.availableEventDates)
    setGeneratedAt(snapshot.generatedAt)
    setLoadError(null)
  }, [])

  const applyBookingPage = useCallback((page: DashboardBookingPage) => {
    setAllBookings(page.bookings)
    setBookingTotal(page.total)
  }, [])

  const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

  const bookingQuery = useMemo<DashboardBookingQuery>(
    () => ({
      eventCode,
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      status: statusFilter,
      rsh: rshFilter,
      eventDate: eventDateFilter,
      search: debouncedSearch,
    }),
    [
      eventCode,
      pagination.pageIndex,
      pagination.pageSize,
      statusFilter,
      rshFilter,
      eventDateFilter,
      debouncedSearch,
    ]
  )
  const bookingQueryRef = useRef(bookingQuery)
  const loadedQueryKey = useRef(JSON.stringify(bookingQuery))

  useEffect(() => {
    bookingQueryRef.current = bookingQuery
  }, [bookingQuery])

  const loadCurrentBookingPage = useCallback(async () => {
    const query = bookingQueryRef.current
    const queryKey = JSON.stringify(query)
    const page = await loadDashboardBookingsPage(query)
    if (queryKey === JSON.stringify(bookingQueryRef.current)) {
      applyBookingPage(page)
    }
  }, [applyBookingPage])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim())
      setPagination((current) =>
        current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const queryKey = JSON.stringify(bookingQuery)
    if (queryKey === loadedQueryKey.current) return
    loadedQueryKey.current = queryKey
    let cancelled = false
    setIsBookingsLoading(true)
    void loadDashboardBookingsPage(bookingQuery)
      .then((page) => {
        if (!cancelled) applyBookingPage(page)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error loading booking page:', error)
          setLoadError(errorMessage(error, 'Failed to load orders'))
        }
      })
      .finally(() => {
        if (!cancelled) setIsBookingsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bookingQuery, applyBookingPage])

  const loadFromCache = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [snapshot] = await Promise.all([
        loadDashboardSnapshot(eventCode),
        loadCurrentBookingPage(),
      ])
      applySnapshot(snapshot)
    } catch (error) {
      console.error('Error loading dashboard snapshot:', error)
      setLoadError(errorMessage(error, 'Failed to load dashboard data'))
    } finally {
      setIsLoading(false)
    }
  }, [eventCode, applySnapshot, loadCurrentBookingPage])

  const handleResync = useCallback(async () => {
    setIsResyncing(true)
    setLoadError(null)
    try {
      const [snapshot] = await Promise.all([
        resyncDashboardSnapshot(eventCode),
        loadCurrentBookingPage(),
      ])
      applySnapshot(snapshot)
    } catch (error) {
      console.error('Error resyncing dashboard:', error)
      setLoadError(errorMessage(error, 'Failed to resync dashboard'))
    } finally {
      setIsResyncing(false)
    }
  }, [eventCode, applySnapshot, loadCurrentBookingPage])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    let refreshing = false
    let pending = false
    let stopped = false

    const refresh = async () => {
      if (stopped || refreshing || !pending) return
      pending = false
      refreshing = true
      try {
        const [snapshot] = await Promise.all([
          loadFreshDashboardSnapshot(eventCode),
          loadCurrentBookingPage(),
        ])
        applySnapshot(snapshot)
      } catch (error) {
        console.error('Error refreshing realtime dashboard data:', error)
        setLoadError(errorMessage(error, 'Failed to refresh dashboard data'))
      } finally {
        refreshing = false
        if (pending && !stopped) scheduleRefresh()
      }
    }

    const scheduleRefresh = () => {
      pending = true
      if (timer || refreshing) return
      timer = setTimeout(() => {
        timer = undefined
        void refresh()
      }, 750)
    }

    const scheduleBookingRefresh = (payload: {
      new?: Record<string, unknown>
      old?: Record<string, unknown>
    }) => {
      const sku = payload.new?.sku ?? payload.old?.sku
      if (typeof sku !== 'string' || sku.includes(eventCode)) scheduleRefresh()
    }

    const channel = supabase
      .channel(`dashboard:${eventCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cad_yip_bookings' },
        scheduleBookingRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cad_yip_attendees' },
        scheduleRefresh
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Dashboard realtime subscription ${status.toLowerCase()}`)
        }
      })

    // Cache tags are deployment-local, so reconcile with the shared DB after
    // the fast cached paint and whenever the user returns from another app.
    scheduleRefresh()
    window.addEventListener('focus', scheduleRefresh)
    const hourlyTimer = window.setInterval(scheduleRefresh, 5 * 60_000)

    return () => {
      stopped = true
      clearTimeout(timer)
      window.clearInterval(hourlyTimer)
      window.removeEventListener('focus', scheduleRefresh)
      void supabase.removeChannel(channel)
    }
  }, [eventCode, applySnapshot, loadCurrentBookingPage])

  const handleBookingSave = useCallback(
    (patch: BookingOpsPatch) => {
      const updated = applyBookingOpsPatch(allBookings, metrics, patch)
      setAllBookings(updated.bookings)
      setMetrics(updated.metrics)
    },
    [allBookings, metrics]
  )

  const hourlyMetrics = useMemo(
    () =>
      hourlySnapshot.map((metric) => ({
        ...metric,
        label: new Date(Number(metric.slotKey)).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [hourlySnapshot]
  )

  const totalCount = bookingTotal

  const clearFilters = () => {
    setSearchTerm('')
    setRshFilter('all')
    setStatusFilter('active')
    setEventDateFilter('')
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  const exportStamp = () => new Date().toISOString().slice(0, 10)

  const handleExport = async () => {
    if (totalCount === 0 || isExporting) return
    setIsExporting(true)
    try {
      const bookings = await loadDashboardExportBookings(bookingQuery)
      downloadCsv(
        `${eventCode.toLowerCase()}-bookings-${exportStamp()}.csv`,
        buildBookingExportCsv(bookings)
      )
    } catch (error) {
      console.error('Export failed:', error)
      window.alert('Could not export bookings. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportRsh = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const bookings = await loadDashboardExportBookings({
        ...bookingQuery,
        rsh: 'rsh',
      })
      if (bookings.length === 0) {
        window.alert('No RSH transfer bookings match the current filters.')
        return
      }
      downloadCsv(
        `${eventCode.toLowerCase()}-rsh-${exportStamp()}.csv`,
        buildBookingExportCsv(bookings)
      )
    } catch (error) {
      console.error('RSH export failed:', error)
      window.alert('Could not export RSH bookings. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopyGrouped = async () => {
    if (totalCount === 0 || isExporting) return
    setIsExporting(true)
    try {
      const text = loadDashboardExportBookings(bookingQuery).then(
        buildGroupedExportText
      )
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': text.then(
              (value) => new Blob([value], { type: 'text/plain' })
            ),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(await text)
      }
    } catch (err) {
      console.error('Copy failed:', err)
      window.alert(
        'Could not copy to clipboard. Check browser permissions or use HTTPS.'
      )
    } finally {
      setIsExporting(false)
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
            Aggregated metrics · paginated live orders
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
                  disabled={totalCount === 0 || isExporting}
                >
                  Copy parties
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleExport()}
                  disabled={totalCount === 0 || isExporting}
                >
                  Export CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleExportRsh()}
                  disabled={isExporting}
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
                  onClick={() => {
                    setStatusFilter(value)
                    setPagination((current) => ({ ...current, pageIndex: 0 }))
                  }}
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
                  onClick={() => {
                    setRshFilter(value)
                    setPagination((current) => ({ ...current, pageIndex: 0 }))
                  }}
                >
                  {label}
                </FilterButton>
              ))}
            </FilterGroup>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Event date</span>
              <select
                value={eventDateFilter}
                onChange={(e) => {
                  setEventDateFilter(e.target.value)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
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
          bookings={allBookings}
          totalCount={bookingTotal}
          pagination={pagination}
          onPaginationChange={setPagination}
          onRowClick={setSelectedBooking}
          isLoading={isLoading || isBookingsLoading}
        />
      </section>

      <OrderModal
        key={selectedBooking?.id ?? 'closed'}
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onSave={handleBookingSave}
        onUpdate={() => {
          void loadFromCache()
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
