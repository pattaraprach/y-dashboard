'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Booking, Attendee } from '@/types/database'

interface OrderModalProps {
    booking: Booking | null
    onClose: () => void
    onUpdate: () => void
}

export function OrderModal({ booking, onClose, onUpdate }: OrderModalProps) {
    const [seat, setSeat] = useState(booking?.seat || '')
    const [pickupLoc, setPickupLoc] = useState(booking?.pickup_loc || '')
    const [isSaving, setIsSaving] = useState(false)
    const [attendees, setAttendees] = useState<Attendee[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchAttendees() {
            if (!booking) return

            const { data, error } = await supabase
                .from('cad_yip_attendees')
                .select('*')
                .eq('booking_id', booking.id)
                .order('id')

            if (error) {
                console.error('Error fetching attendees:', error)
            } else {
                setAttendees((data as Attendee[]) || [])
            }
        }

        if (booking) {
            fetchAttendees()
        }
    }, [booking])

    async function handleSave() {
        if (!booking) return

        setIsSaving(true)
        setError(null)

        const { error } = await supabase
            .from('cad_yip_bookings')
            .update({ seat, pickup_loc: pickupLoc } as Record<string, unknown>)
            .eq('id', booking.id)

        setIsSaving(false)

        if (error) {
            setError('Failed to save changes. Please try again.')
            console.error('Error updating booking:', error)
        } else {
            onUpdate()
            onClose()
        }
    }

    if (!booking) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">
                            Order #{booking.woo_id}
                        </h2>
                        <p className="text-sm text-[var(--foreground-secondary)]">
                            Created {formatDate(booking.created_at)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] transition-colors"
                    >
                        <svg
                            className="w-5 h-5 text-[var(--foreground-secondary)]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Customer Info */}
                <div className="mb-6 p-4 rounded-xl bg-[var(--background)]">
                    <h3 className="text-sm font-medium text-[var(--foreground-secondary)] mb-3">
                        Customer Information
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Name</span>
                            <span className="font-medium">{booking.firstname} {booking.lastname}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Email</span>
                            <span className="text-[var(--accent)]">{booking.email}</span>
                        </div>
                        {booking.phone_e164 && (
                            <div className="flex justify-between">
                                <span className="text-[var(--foreground-muted)]">Phone</span>
                                <span>{booking.phone_e164}</span>
                            </div>
                        )}
                        {booking.country && (
                            <div className="flex justify-between">
                                <span className="text-[var(--foreground-muted)]">Country</span>
                                <span>{booking.country}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Event Info */}
                <div className="mb-6 p-4 rounded-xl bg-[var(--background)]">
                    <h3 className="text-sm font-medium text-[var(--foreground-secondary)] mb-3">
                        Event Details
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Date</span>
                            <span className="badge">{formatDate(booking.event_date)}</span>
                        </div>
                        {booking.event_type && (
                            <div className="flex justify-between">
                                <span className="text-[var(--foreground-muted)]">Type</span>
                                <span className="badge badge-primary">{booking.event_type}</span>
                            </div>
                        )}
                        {booking.zone && (
                            <div className="flex justify-between">
                                <span className="text-[var(--foreground-muted)]">Zone</span>
                                <span>{booking.zone} ({booking.zone_code})</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Attendees */}
                {attendees.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl bg-[var(--background)]">
                        <h3 className="text-sm font-medium text-[var(--foreground-secondary)] mb-3">
                            Attendees ({attendees.length})
                        </h3>
                        <div className="space-y-2">
                            {attendees.map((attendee) => (
                                <div key={attendee.id} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                                    <span>
                                        {attendee.attendee_firstname} {attendee.attendee_lastname}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Financial Info */}
                <div className="mb-6 p-4 rounded-xl bg-[var(--background)]">
                    <h3 className="text-sm font-medium text-[var(--foreground-secondary)] mb-3">
                        Financial
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Amount</span>
                            <span className="font-medium text-[var(--success)]">
                                {formatCurrency(booking.amount)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Commission</span>
                            <span>{formatCurrency(booking.commission)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--foreground-muted)]">Fees</span>
                            <span className="text-[var(--warning)]">
                                {formatCurrency(booking.fees)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[var(--border)]">
                            <span className="font-medium">Net Profit</span>
                            <span className="font-bold text-[var(--success)]">
                                {formatCurrency(booking.commission - booking.fees)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Editable Fields */}
                <div className="mb-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                            Seat Assignment
                        </label>
                        <input
                            type="text"
                            value={seat}
                            onChange={(e) => setSeat(e.target.value)}
                            placeholder="e.g., A1, B2, VIP-01"
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                            Pickup Location
                        </label>
                        <input
                            type="text"
                            value={pickupLoc}
                            onChange={(e) => setPickupLoc(e.target.value)}
                            placeholder="e.g., Hotel Lobby, Airport Terminal 2"
                            className="input"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-[var(--error-bg)] text-[var(--error)] text-sm">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button onClick={onClose} className="btn btn-secondary flex-1">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn btn-primary flex-1"
                    >
                        {isSaving ? (
                            <>
                                <div className="spinner w-4 h-4" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
