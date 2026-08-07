import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
    BookingExportRow,
    BookingWithAttendees,
    ExportParty,
} from '@/types/database'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'THB'): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount)
}

export function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

export function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num)
}

/** Full customer name for display/export */
export function formatCustomerName(booking: {
    firstname?: string | null
    lastname?: string | null
}): string {
    return [booking.firstname, booking.lastname].filter(Boolean).join(' ').trim()
}

export function formatAttendeeName(attendee: {
    attendee_firstname?: string | null
    attendee_lastname?: string | null
}): string {
    return [attendee.attendee_firstname, attendee.attendee_lastname]
        .filter(Boolean)
        .join(' ')
        .trim()
}

/** One party per booking; attendees share seat/pickup. */
function buildExportParties(
    bookings: BookingWithAttendees[],
    options?: { seat?: string | null; pickup?: string | null }
): ExportParty[] {
    const parties: ExportParty[] = []

    for (const booking of bookings) {
        const seat = (options?.seat ?? booking.seat)?.trim() || ''
        const pickup = (options?.pickup ?? booking.pickup_loc)?.trim() || ''
        const names: string[] = []

        for (const attendee of booking.cad_yip_attendees ?? []) {
            const name = formatAttendeeName(attendee)
            if (name) names.push(name)
        }

        if (names.length === 0) {
            const purchaser = formatCustomerName(booking)
            if (purchaser) names.push(purchaser)
        }

        if (names.length === 0) continue

        parties.push({
            orderId: booking.woo_id ?? null,
            seat,
            pickup,
            eventDate: booking.event_date ?? null,
            isRsh: booking.is_rsh_transfer === true,
            isCancelled: booking.is_cancelled === true,
            names,
        })
    }

    return parties
}

function expandPartiesToRows(parties: ExportParty[]): BookingExportRow[] {
    return parties.flatMap((party) => {
        const partySize = party.names.length
        return party.names.map((name, index) => ({
            orderId: party.orderId,
            partySize,
            attendeeIndex: index + 1,
            name,
            seat: party.seat,
            pickup: party.pickup,
            eventDate: party.eventDate,
            isRsh: party.isRsh,
            isCancelled: party.isCancelled,
        }))
    })
}

/**
 * Clipboard text: party header + names, blank line between bookings.
 *
 * #1001 | A12 | Hotel Lobby | Active
 * Alice Tan
 * Bob Tan
 */
export function buildGroupedExportText(
    bookings: BookingWithAttendees[],
    options?: { seat?: string | null; pickup?: string | null }
): string {
    return buildExportParties(bookings, options)
        .map((party) => {
            const orderLabel = party.orderId != null ? `#${party.orderId}` : '#—'
            const seat = party.seat || '—'
            const pickup = party.pickup || '—'
            const status = party.isCancelled ? 'Cancelled' : 'Active'
            return [`${orderLabel} | ${seat} | ${pickup} | ${status}`, ...party.names].join('\n')
        })
        .join('\n\n')
}

function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

/** Manifest CSV: one row per attendee, grouped by Order ID, with Status. */
export function buildBookingExportCsv(bookings: BookingWithAttendees[]): string {
    const rows = expandPartiesToRows(buildExportParties(bookings))
    const header = ['Order ID', 'Party size', 'Attendee #', 'Name', 'Seat', 'Pickup', 'Status']
    const body = rows.map((row) =>
        [
            row.orderId != null ? String(row.orderId) : '',
            String(row.partySize),
            String(row.attendeeIndex),
            row.name,
            row.seat,
            row.pickup,
            row.isCancelled ? 'Cancelled' : 'Active',
        ]
            .map(csvEscape)
            .join(',')
    )
    return [header.join(','), ...body].join('\n')
}

export function downloadCsv(filename: string, csvContent: string): void {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}
