'use client'

import { useEffect, useState } from 'react'
import {
  setBookingCancelled,
  updateBookingOpsFields,
} from '@/app/actions/bookings'
import { supabase } from '@/lib/supabase'
import { getChildCount } from '@/lib/child-count'
import {
  buildGroupedExportText,
  formatAttendeeName,
  formatCurrency,
  formatCustomerName,
  formatDate,
} from '@/lib/utils'
import type { Attendee, BookingWithAttendees } from '@/types/database'
import { Badge } from '@/components/reui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'

interface OrderModalProps {
  booking: BookingWithAttendees | null
  onClose: () => void
  onUpdate: () => void
}

export function OrderModal({ booking, onClose, onUpdate }: OrderModalProps) {
  // Parent remounts via `key={booking.id}` so local state can init from props.
  const [seat, setSeat] = useState(booking?.seat || '')
  const [pickupLoc, setPickupLoc] = useState(booking?.pickup_loc || '')
  const [childCount, setChildCount] = useState(
    booking ? getChildCount(booking) : 0
  )
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
        const { data, error: fetchError } = await supabase
          .from('cad_yip_attendees')
          .select('*')
          .eq('booking_id', booking.id)
          .order('id')

        if (cancelled) return
        if (fetchError) {
          console.error('Error fetching attendees:', fetchError)
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

    try {
      // Allowlisted server action — never open-ended client column updates.
      const result = await updateBookingOpsFields({
        bookingId: booking.id,
        seat,
        pickupLoc,
        childCount: booking.is_rsh_transfer ? childCount : 0,
      })

      if (!result.ok) {
        setError(result.error || 'Failed to save changes. Please try again.')
      } else {
        onUpdate()
        onClose()
      }
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleCancelled() {
    if (!booking) return

    const next = !isCancelled
    const hasWooRefund =
      Boolean(booking.refund_status) && booking.refund_status !== 'none'

    // Block restore when Woo refund evidence remains — no DB write, no resync.
    if (!next && hasWooRefund) {
      setError('This booking still has Woo refund evidence and stays cancelled.')
      return
    }

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

    try {
      const result = await setBookingCancelled({
        bookingId: booking.id,
        cancelled: next,
      })

      if (!result.ok) {
        setError(result.error || `Failed to ${next ? 'cancel' : 'restore'} booking.`)
        return
      }

      setIsCancelled(result.is_cancelled)
      onUpdate()
    } catch {
      setError(`Failed to ${next ? 'cancel' : 'restore'} booking.`)
    } finally {
      setIsTogglingCancel(false)
    }
  }

  function partyTextForBooking() {
    if (!booking) return ''
    const withAttendees: BookingWithAttendees = {
      ...booking,
      is_cancelled: isCancelled,
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
      child_count: booking.is_rsh_transfer ? childCount : 0,
    }
    return buildGroupedExportText([withAttendees], {
      seat,
      pickup: pickupLoc,
      childCount: booking.is_rsh_transfer ? childCount : 0,
    })
  }

  async function handleCopyParty() {
    if (!booking) return
    try {
      await navigator.clipboard.writeText(partyTextForBooking())
      setCopyFeedback('Copied')
      setTimeout(() => setCopyFeedback(null), 1500)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  const open = Boolean(booking)
  const customerName = booking ? formatCustomerName(booking) : ''
  const partyLines = partyTextForBooking()
    ? partyTextForBooking().split('\n')
    : []

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
        {booking ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <DialogTitle>Order #{booking.woo_id}</DialogTitle>
                {!isCancelled ? (
                  <Badge variant="success-light" size="sm">
                    Active
                  </Badge>
                ) : booking.refund_status === 'partial' ? (
                  <Badge variant="warning-light" size="sm">
                    Partial refund
                  </Badge>
                ) : booking.refund_status === 'full' ? (
                  <Badge variant="destructive-light" size="sm">
                    Refunded
                  </Badge>
                ) : (
                  <Badge variant="destructive-light" size="sm">
                    Cancelled
                  </Badge>
                )}
                {booking.woo_status ? (
                  <Badge variant="outline" size="sm">
                    Woo: {booking.woo_status}
                  </Badge>
                ) : null}
              </div>
              <DialogDescription>
                Created {formatDate(booking.created_at)}
                {booking.refunded_at
                  ? ` · Refunded ${formatDate(booking.refunded_at)}`
                  : ''}
                {booking.amount_refunded && booking.amount_refunded > 0
                  ? ` · Refunded ${formatCurrency(booking.amount_refunded)}`
                  : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <section className="rounded-lg border bg-muted/30 p-3">
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Customer
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium text-right">{customerName || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="text-right break-all">{booking.email || '—'}</dd>
                  </div>
                  {booking.phone_e164 ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd>{booking.phone_e164}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="rounded-lg border bg-muted/30 p-3">
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Event
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Date</dt>
                    <dd>
                      <Badge variant="secondary" size="sm">
                        {formatDate(booking.event_date)}
                      </Badge>
                    </dd>
                  </div>
                  {booking.event_type ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Type</dt>
                      <dd>
                        <Badge variant="primary-light" size="sm">
                          {booking.event_type}
                        </Badge>
                      </dd>
                    </div>
                  ) : null}
                  {booking.zone ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Zone</dt>
                      <dd>
                        {booking.zone} ({booking.zone_code})
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {attendees.length > 0 ? (
                <section className="rounded-lg border bg-muted/30 p-3">
                  <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                    Attendees ({attendees.length})
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {attendees.map((attendee) => (
                      <li key={attendee.id}>{formatAttendeeName(attendee)}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="rounded-lg border bg-muted/30 p-3">
                <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                  Financial
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-medium">{formatCurrency(booking.amount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Commission</dt>
                    <dd>{formatCurrency(booking.commission)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Fees</dt>
                    <dd>{formatCurrency(booking.fees)}</dd>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-medium">
                    <dt>Net profit</dt>
                    <dd>{formatCurrency(booking.commission - booking.fees)}</dd>
                  </div>
                </dl>
              </section>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="seat">Seat assignment</Label>
                  <Input
                    id="seat"
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    placeholder="e.g. A1, B2, VIP-01"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pickup">Pickup location</Label>
                  <Input
                    id="pickup"
                    value={pickupLoc}
                    onChange={(e) => setPickupLoc(e.target.value)}
                    placeholder="e.g. Hotel Lobby"
                  />
                </div>
                {booking.is_rsh_transfer ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="child-count">Children (pickup)</Label>
                    <Input
                      id="child-count"
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={childCount}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value, 10)
                        setChildCount(
                          Number.isFinite(n) ? Math.max(0, Math.min(50, n)) : 0
                        )
                      }}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Free on ticket; counted for RSH pickup only. Prefer this
                      over putting +1C in seat.
                    </p>
                  </div>
                ) : null}
                <div className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Party export
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() => void handleCopyParty()}
                    >
                      {copyFeedback || 'Copy'}
                    </Button>
                  </div>
                  <div className="space-y-0.5 font-mono text-xs">
                    {partyLines.length > 0 ? (
                      partyLines.map((line, idx) => (
                        <p
                          key={idx}
                          className={
                            idx === 0 ? 'text-muted-foreground' : 'text-foreground'
                          }
                        >
                          {line || '\u00A0'}
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No attendees to export</p>
                    )}
                  </div>
                </div>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <div className="flex w-full gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void handleSave()}
                  disabled={isSaving || isTogglingCancel}
                >
                  {isSaving ? (
                    <>
                      <Spinner />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant={isCancelled ? 'outline' : 'destructive'}
                className="w-full"
                onClick={() => void handleToggleCancelled()}
                disabled={isSaving || isTogglingCancel}
              >
                {isTogglingCancel
                  ? 'Updating…'
                  : isCancelled
                    ? 'Restore booking'
                    : 'Mark as cancelled'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
