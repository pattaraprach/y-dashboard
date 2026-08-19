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
export default async function CADNYEPage() {
  await connection()
  const [initialSnapshot, initialBookingPage] = await Promise.all([
    loadDashboardSnapshot('CADNYE'),
    loadDashboardBookingsPage({
      eventCode: 'CADNYE',
      ...DEFAULT_BOOKING_QUERY,
    }),
  ])
  return (
    <Dashboard
      eventCode="CADNYE"
      eventName="New Year (CADNYE)"
      initialSnapshot={initialSnapshot}
      initialBookingPage={initialBookingPage}
    />
  )
}
