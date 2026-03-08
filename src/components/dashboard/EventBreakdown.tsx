'use client'

import { useState } from 'react'
import type { EventMetrics } from '@/types/database'
import { formatNumber, formatCurrency } from '@/lib/utils'

interface EventBreakdownProps {
    events: EventMetrics[]
    isLoading?: boolean
}

export function EventBreakdown({ events, isLoading }: EventBreakdownProps) {
    // Store deposited amounts per event type
    const [deposits, setDeposits] = useState<Record<string, number>>({})

    const handleDepositChange = (eventType: string, value: string) => {
        const numValue = parseFloat(value) || 0
        setDeposits((prev) => ({
            ...prev,
            [eventType]: numValue,
        }))
    }

    if (isLoading) {
        return (
            <div className="glass-card p-6">
                <div className="h-6 w-48 bg-[var(--background-tertiary)] rounded animate-pulse mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-[var(--background-tertiary)] rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const maxGuests = Math.max(...events.map((e) => e.totalGuests), 1)

    return (
        <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Event Breakdown & Payments
            </h3>
            <div className="space-y-6">
                {events.length === 0 ? (
                    <p className="text-[var(--foreground-secondary)] text-center py-4">
                        No event data available
                    </p>
                ) : (
                    events.map((event) => {
                        const deposited = deposits[event.eventType] || 0
                        const amountToPay = event.totalAmount - event.totalCommission
                        const leftoverBalance = deposited - amountToPay

                        return (
                            <div key={event.eventType} className="space-y-3 pb-4 border-b border-[var(--border)] last:border-0 last:pb-0">
                                {/* Event header */}
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-[var(--foreground)]">
                                        {event.eventType || 'Unknown'}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-[var(--foreground-secondary)]">
                                            {formatNumber(event.totalOrders)} orders
                                        </span>
                                        <span className="badge badge-primary">
                                            {formatNumber(event.totalGuests)} guests
                                        </span>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="h-2 bg-[var(--background)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                        style={{
                                            width: `${(event.totalGuests / maxGuests) * 100}%`,
                                            background: 'var(--gradient-primary)',
                                        }}
                                    />
                                </div>

                                {/* Financial details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                    {/* Deposit input */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-[var(--foreground-muted)] mb-1">
                                            Deposited
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] text-sm">฿</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={deposits[event.eventType] || ''}
                                                onChange={(e) => handleDepositChange(event.eventType, e.target.value)}
                                                placeholder="0.00"
                                                className="input text-sm py-1.5 pl-6 w-full"
                                            />
                                        </div>
                                    </div>

                                    {/* Amount to pay */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-[var(--foreground-muted)] mb-1">
                                            To Pay (Amt - Comm)
                                        </label>
                                        <div className="text-sm font-medium text-[var(--warning)] bg-[var(--background)] rounded-lg px-3 py-1.5">
                                            {formatCurrency(amountToPay)}
                                        </div>
                                    </div>

                                    {/* Commission */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-[var(--foreground-muted)] mb-1">
                                            Commission
                                        </label>
                                        <div className="text-sm font-medium text-[var(--success)] bg-[var(--background)] rounded-lg px-3 py-1.5">
                                            {formatCurrency(event.totalCommission)}
                                        </div>
                                    </div>

                                    {/* Leftover balance */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-[var(--foreground-muted)] mb-1">
                                            Balance
                                        </label>
                                        <div className={`text-sm font-medium rounded-lg px-3 py-1.5 ${leftoverBalance >= 0
                                                ? 'text-[var(--success)] bg-[var(--success)]/10'
                                                : 'text-[var(--error)] bg-[var(--error)]/10'
                                            }`}>
                                            {leftoverBalance >= 0 ? '+' : ''}{formatCurrency(leftoverBalance)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
