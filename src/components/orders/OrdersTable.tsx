'use client'

import { formatCurrency, formatDate, formatCustomerName } from '@/lib/utils'
import type { Booking } from '@/types/database'

interface OrdersTableProps {
    bookings: Booking[]
    onRowClick: (booking: Booking) => void
    isLoading?: boolean
}

export function OrdersTable({ bookings, onRowClick, isLoading }: OrdersTableProps) {
    if (isLoading) {
        return (
            <div className="glass-card p-8">
                <div className="flex items-center justify-center gap-3">
                    <div className="spinner" />
                    <span className="text-[var(--foreground-secondary)]">Loading orders...</span>
                </div>
            </div>
        )
    }

    if (bookings.length === 0) {
        return (
            <div className="glass-card p-8 text-center">
                <p className="text-[var(--foreground-secondary)]">No orders found</p>
            </div>
        )
    }

    return (
        <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Event Date</th>
                            <th>Zone</th>
                            <th>Amount</th>
                            <th>Seat</th>
                            <th>Pickup</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.map((booking) => {
                            const cancelled = booking.is_cancelled === true
                            return (
                                <tr
                                    key={booking.id}
                                    onClick={() => onRowClick(booking)}
                                    className={cancelled ? 'opacity-60' : undefined}
                                >
                                    <td className="font-mono text-[var(--accent)]">#{booking.woo_id}</td>
                                    <td className={`font-medium ${cancelled ? 'line-through' : ''}`}>
                                        {formatCustomerName(booking)}
                                    </td>
                                    <td className="text-[var(--foreground-secondary)]">{booking.email}</td>
                                    <td>
                                        <span className="badge">{formatDate(booking.event_date)}</span>
                                    </td>
                                    <td>
                                        {booking.zone_code ? (
                                            <span className="badge badge-primary">{booking.zone_code}</span>
                                        ) : (
                                            <span className="text-[var(--foreground-muted)]">—</span>
                                        )}
                                    </td>
                                    <td className="font-medium text-[var(--success)]">
                                        {formatCurrency(booking.amount)}
                                    </td>
                                    <td>
                                        {booking.seat ? (
                                            <span className="badge badge-success">{booking.seat}</span>
                                        ) : (
                                            <span className="text-[var(--foreground-muted)]">Not assigned</span>
                                        )}
                                    </td>
                                    <td>
                                        {booking.pickup_loc ? (
                                            <span className="text-sm">{booking.pickup_loc}</span>
                                        ) : (
                                            <span className="text-[var(--foreground-muted)]">Not set</span>
                                        )}
                                    </td>
                                    <td>
                                        {cancelled ? (
                                            <span className="badge badge-error">Cancelled</span>
                                        ) : (
                                            <span className="badge badge-success">Active</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
