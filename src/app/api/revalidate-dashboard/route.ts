import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { dashboardCacheTag, type EventCode } from '@/lib/build-dashboard-snapshot'

/**
 * Called after Woo CLI sync to bust the shared dashboard snapshot cache.
 * Auth: Authorization: Bearer $DASHBOARD_REVALIDATE_SECRET
 *
 * Body (optional): { "eventCode": "CADCNX" | "CADNYE" | "all" }
 *
 * Note: Route Handlers must use `revalidateTag` (not `updateTag`, which is
 * Server-Action only). `{ expire: 0 }` expires the tag immediately.
 */
export async function POST(request: Request) {
  const secret = process.env.DASHBOARD_REVALIDATE_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'DASHBOARD_REVALIDATE_SECRET is not configured' },
      { status: 503 }
    )
  }

  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let eventCode: EventCode | 'all' = 'all'
  try {
    const body = (await request.json()) as { eventCode?: string }
    if (body?.eventCode === 'CADCNX' || body?.eventCode === 'CADNYE') {
      eventCode = body.eventCode
    } else if (body?.eventCode === 'all' || !body?.eventCode) {
      eventCode = 'all'
    } else {
      return NextResponse.json({ error: 'Invalid eventCode' }, { status: 400 })
    }
  } catch {
    // empty body → revalidate all
  }

  const tags =
    eventCode === 'all'
      ? [dashboardCacheTag('CADCNX'), dashboardCacheTag('CADNYE')]
      : [dashboardCacheTag(eventCode)]

  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 })
  }

  return NextResponse.json({ ok: true, revalidated: tags })
}
