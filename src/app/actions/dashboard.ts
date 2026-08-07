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

/** Require a signed-in user before any dashboard data path (including service-role cache). */
async function requireAuthenticatedUser(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) {
    throw new Error('Unauthorized')
  }
}

/** Load snapshot — shared server cache when service role is set; else live user session. */
export async function loadDashboardSnapshot(
  eventCode: string
): Promise<DashboardSnapshot> {
  await requireAuthenticatedUser()
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
  await requireAuthenticatedUser()
  const code = assertEventCode(eventCode)

  if (hasServiceRoleKey()) {
    updateTag(dashboardCacheTag(code))
    return buildDashboardSnapshot(code)
  }

  const supabase = await createSupabaseServerClient()
  return buildDashboardSnapshot(code, supabase)
}
