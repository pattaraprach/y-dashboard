import { connection } from 'next/server'
import Dashboard from '@/components/Dashboard'

/**
 * Opt out of static prerender: dashboard is client+auth and must not evaluate
 * browser Supabase during `next build` without request-time env.
 */
export default async function CADNYEPage() {
  await connection()
  return <Dashboard eventCode="CADNYE" eventName="New Year (CADNYE)" />
}