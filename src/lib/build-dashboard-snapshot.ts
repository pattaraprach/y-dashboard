import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-admin'
import type {
  DailyMetrics,
  DashboardMetrics,
  EventMetrics,
  HourlyMetrics,
  MonthlySummary,
} from '@/types/database'

export type EventCode = 'CADCNX' | 'CADNYE'

export interface DashboardSnapshot {
  eventCode: EventCode
  generatedAt: string
  availableEventDates: string[]
  metrics: DashboardMetrics
  eventMetrics: EventMetrics[]
  dailyMetrics: DailyMetrics[]
  hourlyMetrics: HourlyMetrics[]
  monthlySummary: MonthlySummary[]
}

type DashboardSummaryRow = Omit<DashboardSnapshot, 'eventCode'>

export function dashboardCacheTag(eventCode: EventCode): string {
  return `dashboard:${eventCode}`
}

/** Uncached aggregate build — one small JSON result, computed in Postgres. */
export async function buildDashboardSnapshot(
  eventCode: EventCode,
  client?: SupabaseClient
): Promise<DashboardSnapshot> {
  const supabase = client ?? createServiceClient()
  const { data, error } = await supabase.rpc('cad_yip_dashboard_summary', {
    p_event_code: eventCode,
  })

  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dashboard summary query returned invalid data.')
  }

  return {
    eventCode,
    ...(data as DashboardSummaryRow),
  }
}
