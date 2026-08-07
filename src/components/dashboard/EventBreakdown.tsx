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
            <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
                <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const maxGuests = Math.max(...events.map((e) => e.totalGuests), 1)

    return (
        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">
                Event Breakdown & Payments
            </h3>
            <div className="space-y-6">
                {events.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                        No event data available
                    </p>
                ) : (
                    events.map((event) => {
                        const deposited = deposits[event.eventType] || 0
                        const amountToPay = event.totalAmount - event.totalCommission
                        const leftoverBalance = deposited - amountToPay

                        return (
                            <div key={event.eventType} className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
                                {/* Event header */}
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">
                                        {event.eventType || 'Unknown'}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-muted-foreground">
                                            {formatNumber(event.totalOrders)} orders
                                        </span>
                                        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                            {formatNumber(event.totalGuests)} guests
                                        </span>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="h-2 bg-background rounded-full overflow-hidden">
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
                                        <label className="text-xs text-muted-foreground mb-1">
                                            Deposited
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={deposits[event.eventType] || ''}
                                                onChange={(e) => handleDepositChange(event.eventType, e.target.value)}
                                                placeholder="0.00"
                                                className="flex h-8 w-full rounded-lg border border-input bg-transparent py-1.5 pl-6 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Amount to pay */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-muted-foreground mb-1">
                                            To Pay (Amt - Comm)
                                        </label>
                                        <div className="text-sm font-medium text-warning-foreground bg-background rounded-lg px-3 py-1.5">
                                            {formatCurrency(amountToPay)}
                                        </div>
                                    </div>

                                    {/* Commission */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-muted-foreground mb-1">
                                            Commission
                                        </label>
                                        <div className="text-sm font-medium text-success bg-background rounded-lg px-3 py-1.5">
                                            {formatCurrency(event.totalCommission)}
                                        </div>
                                    </div>

                                    {/* Leftover balance */}
                                    <div className="flex flex-col">
                                        <label className="text-xs text-muted-foreground mb-1">
                                            Balance
                                        </label>
                                        <div className={`text-sm font-medium rounded-lg px-3 py-1.5 ${leftoverBalance >= 0
                                                ? 'text-success bg-[var(--success)]/10'
                                                : 'text-destructive bg-[var(--error)]/10'
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
