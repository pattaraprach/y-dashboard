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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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
  if (
    !isRecord(data) ||
    typeof data.generatedAt !== 'string' ||
    !isRecord(data.metrics) ||
    !Array.isArray(data.metrics.rshAttendeesByDay) ||
    !Array.isArray(data.availableEventDates) ||
    !Array.isArray(data.eventMetrics) ||
    !Array.isArray(data.dailyMetrics) ||
    !Array.isArray(data.hourlyMetrics) ||
    !Array.isArray(data.monthlySummary)
  ) {
    throw new Error('Dashboard summary query returned invalid data.')
  }

  return {
    eventCode,
    ...(data as DashboardSummaryRow),
  }
}
