import { connection } from 'next/server'
import {
  loadDashboardBookingsPage,
  loadDashboardSnapshot,
} from '@/app/actions/dashboard'
import Dashboard from '@/components/Dashboard'
import { DEFAULT_BOOKING_QUERY } from '@/lib/bookings-query'

/**
 * Opt out of static prerender: dashboard is client+auth and must not evaluate
 * browser Supabase during `next build` without request-time env.
 */
export default async function CADCNXPage() {
  await connection()
  const [initialSnapshot, initialBookingPage] = await Promise.all([
    loadDashboardSnapshot('CADCNX'),
    loadDashboardBookingsPage({
      eventCode: 'CADCNX',
      ...DEFAULT_BOOKING_QUERY,
    }),
  ])
  return (
    <Dashboard
      eventCode="CADCNX"
      eventName="Yipeng (CADCNX)"
      initialSnapshot={initialSnapshot}
      initialBookingPage={initialBookingPage}
    />
  )
}
