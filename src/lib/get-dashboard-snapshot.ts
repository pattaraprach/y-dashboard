import { cacheLife, cacheTag } from 'next/cache'
import {
  buildDashboardSnapshot,
  dashboardCacheTag,
  type DashboardSnapshot,
  type EventCode,
} from '@/lib/build-dashboard-snapshot'

/**
 * Shared server cache of the full event dashboard snapshot.
 * Soft TTL via "hours" profile; Resync uses updateTag + fresh build.
 */
export async function getCachedDashboardSnapshot(
  eventCode: EventCode
): Promise<DashboardSnapshot> {
  'use cache'
  cacheTag(dashboardCacheTag(eventCode))
  // Soft background revalidate; ops can force with Resync anytime.
  cacheLife('hours')
  return buildDashboardSnapshot(eventCode)
}
