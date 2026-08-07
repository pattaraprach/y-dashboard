import { describe, expect, it } from 'vitest'
import {
  formatChildCountSuffix,
  getChildCount,
  parseChildCountFromSeat,
  rshPickupHeadcount,
  ticketGuestCount,
} from './child-count'

describe('parseChildCountFromSeat', () => {
  it('parses +1C alone or with seat label', () => {
    expect(parseChildCountFromSeat('+1C')).toBe(1)
    expect(parseChildCountFromSeat('A12 +1C')).toBe(1)
    expect(parseChildCountFromSeat('VIP +2c')).toBe(2)
    expect(parseChildCountFromSeat('+ 3 C')).toBe(3)
    expect(parseChildCountFromSeat('SO38 SO39 SO40 +2C')).toBe(2)
    expect(parseChildCountFromSeat('SJ27 SJ28 +2CHD')).toBe(2)
  })

  it('returns 0 when absent', () => {
    expect(parseChildCountFromSeat('A12')).toBe(0)
    expect(parseChildCountFromSeat(null)).toBe(0)
    expect(parseChildCountFromSeat('')).toBe(0)
  })
})

describe('getChildCount', () => {
  it('prefers explicit child_count when positive', () => {
    expect(getChildCount({ child_count: 2, seat: 'A12 +1C' })).toBe(2)
  })

  it('falls back to seat +NC when child_count is 0', () => {
    expect(getChildCount({ child_count: 0, seat: 'A12 +1C' })).toBe(1)
  })
})

describe('headcounts', () => {
  it('ticket guests exclude children', () => {
    expect(
      ticketGuestCount({
        cad_yip_attendees: [{ id: 1 }, { id: 2 }] as never,
      })
    ).toBe(2)
  })

  it('RSH pickup adds children; non-RSH does not', () => {
    const base = {
      cad_yip_attendees: [{ id: 1 }, { id: 2 }] as never,
      child_count: 1,
      seat: null,
    }
    expect(rshPickupHeadcount({ ...base, is_rsh_transfer: true })).toBe(3)
    expect(rshPickupHeadcount({ ...base, is_rsh_transfer: false })).toBe(2)
  })
})

describe('formatChildCountSuffix', () => {
  it('formats +NC or empty', () => {
    expect(formatChildCountSuffix(0)).toBe('')
    expect(formatChildCountSuffix(1)).toBe('+1C')
    expect(formatChildCountSuffix(2)).toBe('+2C')
  })
})
