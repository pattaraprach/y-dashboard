import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatChildCountSuffix, getChildCount } from '@/lib/child-count'
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
    options?: {
        seat?: string | null
        pickup?: string | null
        childCount?: number | null
    }
): ExportParty[] {
    const parties: ExportParty[] = []

    for (const booking of bookings) {
        const seat = (options?.seat ?? booking.seat)?.trim() || ''
        const pickup = (options?.pickup ?? booking.pickup_loc)?.trim() || ''
        const childCount =
            options?.childCount != null
                ? Math.max(0, Math.floor(options.childCount))
                : getChildCount({
                      child_count: booking.child_count,
                      seat: options?.seat ?? booking.seat,
                  })
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
            phone: (booking.phone_raw || booking.phone_e164 || '').trim(),
            seat,
            pickup,
            eventDate: booking.event_date ?? null,
            isRsh: booking.is_rsh_transfer === true,
            isCancelled: booking.is_cancelled === true,
            childCount: booking.is_rsh_transfer ? childCount : 0,
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
            phone: party.phone,
            seat: party.seat,
            pickup: party.pickup,
            eventDate: party.eventDate,
            isRsh: party.isRsh,
            isCancelled: party.isCancelled,
            childCount: party.childCount,
        }))
    })
}

/**
 * Clipboard text: party header + names, blank line between bookings.
 *
 * #1001 | A12 | Hotel Lobby | Active | +1C
 * Alice Tan
 * Bob Tan
 */
export function buildGroupedExportText(
    bookings: BookingWithAttendees[],
    options?: {
        seat?: string | null
        pickup?: string | null
        childCount?: number | null
    }
): string {
    return buildExportParties(bookings, options)
        .map((party) => {
            const orderLabel = party.orderId != null ? `#${party.orderId}` : '#—'
            const seat = party.seat || '—'
            const pickup = party.pickup || '—'
            const status = party.isCancelled ? 'Cancelled' : 'Active'
            const child = formatChildCountSuffix(party.childCount)
            const fields = [orderLabel, seat, pickup]
            if (party.phone) fields.push(party.phone)
            fields.push(status)
            if (child) fields.push(child)
            const header = fields.join(' | ')
            return [header, ...party.names].join('\n')
        })
        .join('\n\n')
}

/**
 * CSV cell escape. Neutralize formula injection for Excel/Sheets
 * (=, +, -, @, tab/CR) by prefixing a single quote before quoting.
 */
function csvEscape(value: string): string {
    let cell = value
    if (/^[=+\-@\t\r]/.test(cell)) {
        cell = `'${cell}`
    }
    if (/[",\n\r]/.test(cell)) {
        return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
}

/** Manifest CSV: one row per attendee, grouped by Order ID, with Status + Children (RSH). */
export function buildBookingExportCsv(bookings: BookingWithAttendees[]): string {
    const rows = expandPartiesToRows(buildExportParties(bookings))
    const header = [
        'Order ID',
        'Party size',
        'Attendee #',
        'Name',
        'Phone',
        'Seat',
        'Pickup',
        'Status',
        'Children',
    ]
    const body = rows.map((row) =>
        [
            row.orderId != null ? String(row.orderId) : '',
            String(row.partySize),
            String(row.attendeeIndex),
            row.name,
            row.phone,
            row.seat,
            row.pickup,
            row.isCancelled ? 'Cancelled' : 'Active',
            row.isRsh ? String(row.childCount) : '0',
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
