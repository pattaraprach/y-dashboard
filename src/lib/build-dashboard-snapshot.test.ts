import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDashboardSnapshot } from './build-dashboard-snapshot'

vi.mock('@/lib/supabase-admin', () => ({
  createServiceClient: vi.fn(),
}))

const validSummary = {
  generatedAt: '2026-08-20T00:00:00.000Z',
  metrics: {},
  availableEventDates: [],
  eventMetrics: [],
  dailyMetrics: [],
  hourlyMetrics: [],
  monthlySummary: [],
}

function clientReturning(data: unknown): SupabaseClient {
  return {
    rpc: async () => ({ data, error: null }),
  } as unknown as SupabaseClient
}

describe('buildDashboardSnapshot', () => {
  it('accepts a complete dashboard summary', async () => {
    await expect(
      buildDashboardSnapshot('CADCNX', clientReturning(validSummary))
    ).resolves.toMatchObject({ eventCode: 'CADCNX', ...validSummary })
  })

  it.each([
    { ...validSummary, generatedAt: null },
    { ...validSummary, metrics: [] },
    { ...validSummary, availableEventDates: {} },
    { ...validSummary, eventMetrics: {} },
    { ...validSummary, dailyMetrics: {} },
    { ...validSummary, hourlyMetrics: {} },
    { ...validSummary, monthlySummary: {} },
  ])('rejects an incomplete summary', async (data) => {
    await expect(
      buildDashboardSnapshot('CADCNX', clientReturning(data))
    ).rejects.toThrow('Dashboard summary query returned invalid data.')
  })
})
