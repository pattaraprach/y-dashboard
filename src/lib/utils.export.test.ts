import { describe, expect, it } from 'vitest'
import type { BookingWithAttendees } from '@/types/database'
import { buildBookingExportCsv, buildGroupedExportText } from './utils'

function booking(
  partial: Partial<BookingWithAttendees> & {
    id: number
    woo_id?: number
    firstname?: string
    lastname?: string
  }
): BookingWithAttendees {
  return {
    created_at: null,
    order_created_at: null,
    woo_id: partial.woo_id ?? partial.id,
    firstname: partial.firstname ?? 'Pat',
    lastname: partial.lastname ?? 'Buyer',
    email: 'p@example.com',
    phone_raw: null,
    phone_e164: null,
    country: null,
    sku: 'CADCNX',
    seat: partial.seat ?? null,
    is_rsh_transfer: partial.is_rsh_transfer ?? false,
    pickup_loc: partial.pickup_loc ?? null,
    child_count: partial.child_count ?? 0,
    amount: 1000,
    commission: 0,
    fees: 0,
    gateway: null,
    event_date: partial.event_date ?? null,
    zone_code: null,
    zone: null,
    event_type: null,
    is_cancelled: partial.is_cancelled ?? false,
    quantity: 1,
    pickup_type: null,
    pickup_link: null,
    amount_refunded: 0,
    amount_net: 1000,
    woo_status: 'completed',
    refund_status: 'none',
    cancel_source: null,
    cancelled_at: null,
    refunded_at: null,
    last_synced_at: null,
    cad_yip_attendees: partial.cad_yip_attendees ?? [],
    ...partial,
  }
}

describe('party export', () => {
  it('groups one party header with Status and lists attendees', () => {
    const rows = [
      booking({
        id: 1,
        woo_id: 1001,
        seat: 'A12',
        pickup_loc: 'Hotel Lobby',
        is_cancelled: false,
        cad_yip_attendees: [
          { id: 1, attendee_firstname: 'Alice', attendee_lastname: 'Tan' },
          { id: 2, attendee_firstname: 'Bob', attendee_lastname: 'Tan' },
        ],
      }),
    ]

    const text = buildGroupedExportText(rows)
    expect(text).toBe('#1001 | A12 | Hotel Lobby | Active\nAlice Tan\nBob Tan')
  })

  it('appends +NC on RSH party export when children set', () => {
    const rows = [
      booking({
        id: 1,
        woo_id: 125098,
        seat: 'A12',
        pickup_loc: 'Hotel Lobby',
        is_rsh_transfer: true,
        child_count: 1,
        cad_yip_attendees: [
          { id: 1, attendee_firstname: 'Alice', attendee_lastname: 'Tan' },
        ],
      }),
    ]

    const text = buildGroupedExportText(rows)
    expect(text).toBe(
      '#125098 | A12 | Hotel Lobby | Active | +1C\nAlice Tan'
    )
  })

  it('marks cancelled parties and falls back to purchaser when no attendees', () => {
    const rows = [
      booking({
        id: 2,
        woo_id: 2002,
        firstname: 'Sam',
        lastname: 'Lee',
        seat: 'B1',
        pickup_loc: null,
        is_cancelled: true,
        cad_yip_attendees: [],
      }),
    ]

    const text = buildGroupedExportText(rows)
    expect(text).toBe('#2002 | B1 | — | Cancelled\nSam Lee')
  })

  it('builds CSV with Status and one row per attendee', () => {
    const rows = [
      booking({
        id: 1,
        woo_id: 1001,
        seat: 'A12',
        pickup_loc: 'Lobby',
        cad_yip_attendees: [
          { id: 1, attendee_firstname: 'Alice', attendee_lastname: 'Tan' },
          { id: 2, attendee_firstname: 'Bob', attendee_lastname: 'Tan' },
        ],
      }),
      booking({
        id: 2,
        woo_id: 2002,
        seat: 'B1',
        pickup_loc: 'Dock',
        is_cancelled: true,
        cad_yip_attendees: [{ id: 3, attendee_firstname: 'Cara', attendee_lastname: 'Ng' }],
      }),
    ]

    const csv = buildBookingExportCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'Order ID,Party size,Attendee #,Name,Seat,Pickup,Status,Children'
    )
    expect(lines[1]).toBe('1001,2,1,Alice Tan,A12,Lobby,Active,0')
    expect(lines[2]).toBe('1001,2,2,Bob Tan,A12,Lobby,Active,0')
    expect(lines[3]).toBe('2002,1,1,Cara Ng,B1,Dock,Cancelled,0')
  })

  it('escapes commas and quotes in names', () => {
    const rows = [
      booking({
        id: 1,
        woo_id: 9,
        seat: 'S1',
        pickup_loc: 'Main, Gate',
        cad_yip_attendees: [
          { id: 1, attendee_firstname: 'Ada "A"', attendee_lastname: 'Lovelace' },
        ],
      }),
    ]

    const csv = buildBookingExportCsv(rows)
    expect(csv).toContain('"Ada ""A"" Lovelace"')
    expect(csv).toContain('"Main, Gate"')
  })
})
