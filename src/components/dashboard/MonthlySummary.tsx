'use client'

import { useState } from 'react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { MonthlySummary } from '@/types/database'

interface MonthlySummaryProps {
  data: MonthlySummary[]
  isLoading: boolean
}

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

export function MonthlySummary({ data, isLoading }: MonthlySummaryProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedEventDays, setExpandedEventDays] = useState<Set<string>>(new Set())

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(month)) {
      newExpanded.delete(month)
    } else {
      newExpanded.add(month)
    }
    setExpandedMonths(newExpanded)
  }

  const toggleEventDay = (key: string) => {
    const newExpanded = new Set(expandedEventDays)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedEventDays(newExpanded)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Monthly Summary</h3>
        </div>
        <div className="p-8 text-center text-[var(--foreground-secondary)]">
          Loading monthly summary...
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Monthly Summary</h3>
        </div>
        <div className="p-8 text-center text-[var(--foreground-secondary)]">
          No data available
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Monthly Summary</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          Ticket type breakdown by event day
        </p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {data.map((monthData) => {
          const isMonthExpanded = expandedMonths.has(monthData.month)

          return (
            <div key={monthData.month}>
              {/* Month Header */}
              <button
                onClick={() => toggleMonth(monthData.month)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--background-secondary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ChevronIcon isOpen={isMonthExpanded} />
                  <div className="text-left">
                    <h4 className="font-semibold text-[var(--foreground)]">
                      {monthData.monthDisplay}
                    </h4>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {formatNumber(monthData.totalOrders)} orders · {formatCurrency(monthData.totalAmount)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--success)]">
                    {formatCurrency(monthData.totalCommission)} commission
                  </p>
                </div>
              </button>

              {/* Month Content */}
              {isMonthExpanded && (
                <div className="bg-[var(--background-secondary)] divide-y divide-[var(--border)]">
                  {monthData.eventDays.map((eventDay) => {
                    const eventDayKey = `${monthData.month}-${eventDay.eventDate}`
                    const isEventExpanded = expandedEventDays.has(eventDayKey)

                    return (
                      <div key={eventDayKey}>
                        {/* Event Day Header */}
                        <button
                          onClick={() => toggleEventDay(eventDayKey)}
                          className="w-full px-6 py-3 pl-12 flex items-center justify-between hover:bg-[var(--background-tertiary)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <ChevronIcon isOpen={isEventExpanded} />
                            <div className="text-left">
                              <h5 className="font-medium text-[var(--foreground)]">
                                {formatDate(eventDay.eventDate)}
                              </h5>
                              <p className="text-xs text-[var(--foreground-secondary)]">
                                {formatNumber(eventDay.totalOrders)} orders · {eventDay.ticketTypes.length} ticket types
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(eventDay.totalAmount)}</p>
                            <p className="text-xs text-[var(--foreground-secondary)]">
                              {formatCurrency(eventDay.totalCommission)} comm.
                            </p>
                          </div>
                        </button>

                        {/* Ticket Types Table */}
                        {isEventExpanded && (
                          <div className="px-6 py-4 pl-16 bg-[var(--background)]">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left border-b border-[var(--border)]">
                                  <th className="pb-2 font-medium text-[var(--foreground-secondary)]">Ticket Type</th>
                                  <th className="pb-2 font-medium text-[var(--foreground-secondary)]">SKU</th>
                                  <th className="pb-2 font-medium text-[var(--foreground-secondary)] text-right">Quantity</th>
                                  <th className="pb-2 font-medium text-[var(--foreground-secondary)] text-right">Total Amount</th>
                                  <th className="pb-2 font-medium text-[var(--foreground-secondary)] text-right">Commission</th>
                                </tr>
                              </thead>
                              <tbody>
                                {eventDay.ticketTypes.map((ticket, idx) => (
                                  <tr
                                    key={`${ticket.sku}-${idx}`}
                                    className="border-b border-[var(--border)] last:border-0"
                                  >
                                    <td className="py-2 text-[var(--foreground)]">{ticket.eventType || 'Unknown'}</td>
                                    <td className="py-2 text-[var(--foreground-secondary)] font-mono text-xs">
                                      {ticket.sku || 'N/A'}
                                    </td>
                                    <td className="py-2 text-right font-medium">{formatNumber(ticket.quantity)}</td>
                                    <td className="py-2 text-right font-medium">{formatCurrency(ticket.totalAmount)}</td>
                                    <td className="py-2 text-right text-[var(--success)] font-medium">
                                      {formatCurrency(ticket.totalCommission)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
