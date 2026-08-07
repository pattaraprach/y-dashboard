'use server'

import { updateTag } from 'next/cache'
import {
  buildDashboardSnapshot,
  dashboardCacheTag,
  type DashboardSnapshot,
  type EventCode,
} from '@/lib/build-dashboard-snapshot'
import { getCachedDashboardSnapshot } from '@/lib/get-dashboard-snapshot'
import { hasServiceRoleKey } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function assertEventCode(code: string): EventCode {
  if (code !== 'CADCNX' && code !== 'CADNYE') {
    throw new Error(`Invalid event code: ${code}`)
  }
  return code
}

/** Load snapshot — shared server cache when service role is set; else live user session. */
export async function loadDashboardSnapshot(
  eventCode: string
): Promise<DashboardSnapshot> {
  const code = assertEventCode(eventCode)

  if (hasServiceRoleKey()) {
    return getCachedDashboardSnapshot(code)
  }

  // No SUPABASE_SERVICE_KEY: fetch with the signed-in user (uncached).
  const supabase = await createSupabaseServerClient()
  return buildDashboardSnapshot(code, supabase)
}

/**
 * Force-refresh. With service role: invalidate tag + rebuild cache.
 * Without: live rebuild via user session.
 */
export async function resyncDashboardSnapshot(
  eventCode: string
): Promise<DashboardSnapshot> {
  const code = assertEventCode(eventCode)

  if (hasServiceRoleKey()) {
    updateTag(dashboardCacheTag(code))
    return buildDashboardSnapshot(code)
  }

  const supabase = await createSupabaseServerClient()
  return buildDashboardSnapshot(code, supabase)
}
