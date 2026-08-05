'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
    buildGroupedExportText,
    formatAttendeeName,
    formatCurrency,
    formatCustomerName,
    formatDate,
} from '@/lib/utils'
import type { Attendee, BookingWithAttendees } from '@/types/database'

interface OrderModalProps {
    booking: BookingWithAttendees | null
    onClose: () => void
    onUpdate: () => void
}

export function OrderModal({ booking, onClose, onUpdate }: OrderModalProps) {
    const [seat, setSeat] = useState(booking?.seat || '')
    const [pickupLoc, setPickupLoc] = useState(booking?.pickup_loc || '')
    const [isCancelled, setIsCancelled] = useState(booking?.is_cancelled ?? false)
    const [isSaving, setIsSaving] = useState(false)
    const [isTogglingCancel, setIsTogglingCancel] = useState(false)
    const [attendees, setAttendees] = useState<Attendee[]>([])
    const [error, setError] = useState<string | null>(null)
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

    useEffect(() => {
        if (!booking) return

        let cancelled = false
        const timer = setTimeout(() => {
            void (async () => {
                const { data, error } = await supabase
                    .from('cad_yip_attendees')
                    .select('*')
                    .eq('booking_id', booking.id)
                    .order('id')

                if (cancelled) return
                if (error) {
                    console.error('Error fetching attendees:', error)
                } else {
                    setAttendees((data as Attendee[]) || [])
                }
            })()
        }, 0)

        return () => {
            cancelled = true
            clearTimeout(timer)
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

    async function handleToggleCancelled() {
        if (!booking) return

        const next = !isCancelled
        const action = next ? 'cancel' : 'restore'
        if (
            !window.confirm(
                next
                    ? `Mark order #${booking.woo_id} as cancelled? It will be excluded from dashboard metrics.`
                    : `Restore order #${booking.woo_id} as active?`
            )
        ) {
            return
        }

        setIsTogglingCancel(true)
        setError(null)

        const { error } = await supabase
            .from('cad_yip_bookings')
            .update({ is_cancelled: next } as Record<string, unknown>)
            .eq('id', booking.id)

        setIsTogglingCancel(false)

        if (error) {
            setError(`Failed to ${action} booking. Please try again.`)
            console.error('Error toggling cancel:', error)
            return
        }

        setIsCancelled(next)
        onUpdate()
    }

    function partyTextForBooking() {
        if (!booking) return ''
        const withAttendees: BookingWithAttendees = {
            ...booking,
            cad_yip_attendees:
                attendees.length > 0
                    ? attendees.map((a) => ({
                          id: a.id,
                          attendee_firstname: a.attendee_firstname,
                          attendee_lastname: a.attendee_lastname,
                      }))
                    : booking.cad_yip_attendees,
            seat,
            pickup_loc: pickupLoc,
        }
        return buildGroupedExportText([withAttendees], { seat, pickup: pickupLoc })
    }

    async function handleCopyParty() {
        if (!booking) return
        const text = partyTextForBooking()
        try {
            await navigator.clipboard.writeText(text)
            setCopyFeedback('Copied')
            setTimeout(() => setCopyFeedback(null), 1500)
        } catch {
            setError('Could not copy to clipboard.')
        }
    }

    if (!booking) return null

    const customerName = formatCustomerName(booking)
    const partyText = partyTextForBooking()
    const partyLines = partyText ? partyText.split('\n') : []

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-bold text-[var(--foreground)]">
                                Order #{booking.woo_id}
                            </h2>
                            {isCancelled && (
                                <span className="badge badge-error">Cancelled</span>
                            )}
                        </div>
                        <p className="text-sm text-[var(--foreground-secondary)]">
                            Created {formatDate(booking.created_at)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[var(--background-tertiary)] transition-colors"
                        aria-label="Close"
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
                        <div className="flex justify-between gap-4">
                            <span className="text-[var(--foreground-muted)]">Name</span>
                            <span className="font-medium text-right">{customerName}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-[var(--foreground-muted)]">Email</span>
                            <span className="text-[var(--accent)] text-right break-all">{booking.email}</span>
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
                                    <span>{formatAttendeeName(attendee)}</span>
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
                    <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-[var(--foreground-secondary)]">
                                Party export (header + attendees)
                            </span>
                            <button
                                type="button"
                                onClick={() => void handleCopyParty()}
                                className="text-xs font-medium text-[var(--primary)] hover:underline"
                            >
                                {copyFeedback || 'Copy'}
                            </button>
                        </div>
                        <div className="space-y-0.5">
                            {partyLines.length > 0 ? (
                                partyLines.map((line, idx) => (
                                    <p
                                        key={idx}
                                        className={`text-sm font-mono break-all ${
                                            idx === 0
                                                ? 'text-[var(--foreground-secondary)]'
                                                : 'text-[var(--foreground)]'
                                        }`}
                                    >
                                        {line || '\u00A0'}
                                    </p>
                                ))
                            ) : (
                                <p className="text-sm text-[var(--foreground-muted)]">No attendees to export</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-[var(--error-bg)] text-[var(--error)] text-sm">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn btn-secondary flex-1">
                            Close
                        </button>
                        <button
                            onClick={() => void handleSave()}
                            disabled={isSaving || isTogglingCancel}
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
                    <button
                        type="button"
                        onClick={() => void handleToggleCancelled()}
                        disabled={isSaving || isTogglingCancel}
                        className={`btn flex-1 ${isCancelled ? 'btn-secondary' : 'btn-danger'}`}
                    >
                        {isTogglingCancel
                            ? 'Updating…'
                            : isCancelled
                              ? 'Restore booking'
                              : 'Mark as cancelled'}
                    </button>
                </div>
            </div>
        </div>
    )
}
