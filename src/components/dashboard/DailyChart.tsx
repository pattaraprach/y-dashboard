'use client'

import { useState, useMemo } from 'react'
import type { DailyMetrics, HourlyMetrics } from '@/types/database'
import { formatNumber } from '@/lib/utils'

type TimeRange = '24h' | '3d' | '7d' | '30d'

const RANGES: { label: string; value: TimeRange; days: number }[] = [
  { label: '24h', value: '24h', days: 1 },
  { label: '3d',  value: '3d',  days: 3 },
  { label: '7d',  value: '7d',  days: 7 },
  { label: '30d', value: '30d', days: 30 },
]

interface DailyChartProps {
  data: DailyMetrics[]
  hourlyData: HourlyMetrics[]
  isLoading?: boolean
}

/** Which bar indices should show an x-axis label to avoid crowding */
function showLabel(index: number, total: number): boolean {
  if (total <= 7)  return true
  if (total <= 14) return index % 2 === 0
  if (total === 24) return index % 4 === 0 || index === 23
  return index % 5 === 0 || index === total - 1
}

export function DailyChart({ data, hourlyData, isLoading }: DailyChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  const dailyFiltered = useMemo(() => {
    const range = RANGES.find(r => r.value === timeRange)!
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (range.days - 1))
    cutoff.setHours(0, 0, 0, 0)

    return [...data]
      .filter(d => new Date(d.date + 'T00:00:00') >= cutoff)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [data, timeRange])

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  const is24h = timeRange === '24h'
  const bars = is24h
    ? hourlyData.map((h, i) => ({
        // Prefer stable slotKey so DST fall-back does not collide on label.
        key:        h.slotKey || `${h.label}-${i}`,
        xLabel:     h.label,
        total:      h.totalOrders,
        rsh:        h.rshOrders,
        nonRsh:     h.nonRshOrders,
        guests:     h.totalGuests,
      }))
    : dailyFiltered.map(d => {
        const date = new Date(d.date + 'T00:00:00')
        return {
          key:    d.date,
          xLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          total:  d.totalOrders,
          rsh:    d.rshGuests,
          nonRsh: d.nonRshGuests,
          guests: d.totalGuests,
        }
      })

  const maxTotal = Math.max(...bars.map(b => b.total), 1)
  const total    = bars.length

  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">
          Daily Bookings
        </h3>
        <div className="flex rounded-lg overflow-hidden border border-border">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                timeRange === r.value
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--gradient-primary)' }} />
          <span className="text-xs text-muted-foreground">RSH</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--gradient-accent)' }} />
          <span className="text-xs text-muted-foreground">Non-RSH</span>
        </div>
        {is24h && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Rolling 24 hours
          </span>
        )}
      </div>

      {/* Chart */}
      {bars.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No bookings in this period
        </p>
      ) : (
        <div className="flex items-end gap-px w-full h-52">
          {bars.map((bar, i) => {
            const barHeightPct = Math.max((bar.total / maxTotal) * 100, bar.total > 0 ? 4 : 0)
            const rshPct       = bar.total ? (bar.rsh    / bar.total) * 100 : 0
            const nonRshPct    = bar.total ? (bar.nonRsh / bar.total) * 100 : 0
            const showCount    = total <= 10 && bar.total > 0

            return (
              <div
                key={bar.key}
                className="relative flex flex-col items-center justify-end flex-1 min-w-0 h-full group"
              >
                {/* Tooltip */}
                <div
                  className={`opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 pointer-events-none z-20 w-40 bg-background border border-border rounded-lg px-3 py-2 shadow-lg ${
                    i < total / 2 ? 'left-0' : 'right-0'
                  }`}
                >
                  <p className="text-xs text-muted-foreground mb-1">{bar.xLabel}</p>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {formatNumber(bar.total)} bookings
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-primary">
                      <span>RSH:</span>
                      <span>{formatNumber(bar.rsh)}</span>
                    </div>
                    <div className="flex justify-between text-foreground">
                      <span>Non-RSH:</span>
                      <span>{formatNumber(bar.nonRsh)}</span>
                    </div>
                    <div className="pt-1 border-t border-[var(--border-secondary)] text-muted-foreground flex justify-between">
                      <span>Guests:</span>
                      <span>{formatNumber(bar.guests)}</span>
                    </div>
                  </div>
                </div>

                {/* Count above bar */}
                {showCount && (
                  <span className="text-[10px] text-muted-foreground mb-0.5 leading-none">
                    {bar.total}
                  </span>
                )}

                {/* Stacked bar */}
                <div
                  className="w-full flex flex-col justify-end overflow-hidden rounded-t-sm transition-all duration-300"
                  style={{ height: `${barHeightPct}%`, maxWidth: '32px' }}
                >
                  {/* Non-RSH (top) */}
                  <div
                    className="w-full"
                    style={{ height: `${nonRshPct}%`, background: 'var(--gradient-accent)' }}
                  />
                  {/* RSH (bottom) */}
                  <div
                    className="w-full"
                    style={{ height: `${rshPct}%`, background: 'var(--gradient-primary)' }}
                  />
                </div>

                {/* X-axis label */}
                <span
                  className={`text-[9px] text-muted-foreground mt-1 whitespace-nowrap overflow-hidden ${
                    showLabel(i, total) ? '' : 'invisible'
                  }`}
                >
                  {bar.xLabel}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
