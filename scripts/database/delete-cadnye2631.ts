#!/usr/bin/env ts-node

/**
 * Delete all bookings (and their attendees + links) for CADNYE2631 SKUs.
 *
 * Usage:
 *   npm run delete:cadnye2631 -- --dry-run    # preview what would be deleted
 *   npm run delete:cadnye2631                  # actually delete
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const TARGET_SKU_PATTERN = 'CADNYE2631'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

async function run() {
  console.log('='.repeat(60))
  console.log(`Delete ${TARGET_SKU_PATTERN} Bookings${dryRun ? ' [DRY RUN]' : ''}`)
  console.log('='.repeat(60))
  if (dryRun) {
    console.log('⚠️  DRY RUN - No changes will be made\n')
  }

  // 1. Find all matching bookings
  const { data: bookings, error: fetchError } = await supabase
    .from('cad_yip_bookings')
    .select('id, woo_id, sku, firstname, lastname')
    .ilike('sku', `%${TARGET_SKU_PATTERN}%`)
    .order('id', { ascending: true })

  if (fetchError) {
    console.error('Failed to fetch bookings:', fetchError.message)
    process.exit(1)
  }

  if (!bookings || bookings.length === 0) {
    console.log(`No bookings found with SKU containing "${TARGET_SKU_PATTERN}".`)
    process.exit(0)
  }

  const bookingIds = bookings.map(b => b.id)

  console.log(`Found ${bookings.length} booking(s) to delete:\n`)
  bookings.forEach(b => {
    console.log(`  ID ${b.id} | WooID #${b.woo_id} | SKU: ${b.sku} | ${b.firstname} ${b.lastname}`)
  })
  console.log('')

  // 2. Count linked attendees and links
  const { count: attendeeCount } = await supabase
    .from('cad_yip_attendees')
    .select('id', { count: 'exact', head: true })
    .in('booking_id', bookingIds)

  const { count: linkCount } = await supabase
    .from('cad_yip_links')
    .select('id', { count: 'exact', head: true })
    .in('booking_id', bookingIds)

  console.log(`  Attendees to delete: ${attendeeCount ?? 0}`)
  console.log(`  Links to delete:     ${linkCount ?? 0}`)
  console.log(`  Bookings to delete:  ${bookings.length}`)
  console.log('')

  if (dryRun) {
    console.log('DRY RUN complete. Run without --dry-run to apply deletions.')
    return
  }

  // 3. Delete attendees
  const { error: attendeeError } = await supabase
    .from('cad_yip_attendees')
    .delete()
    .in('booking_id', bookingIds)

  if (attendeeError) {
    console.error('Failed to delete attendees:', attendeeError.message)
    process.exit(1)
  }
  console.log(`✓ Deleted ${attendeeCount ?? 0} attendee(s)`)

  // 4. Delete links
  const { error: linkError } = await supabase
    .from('cad_yip_links')
    .delete()
    .in('booking_id', bookingIds)

  if (linkError) {
    console.error('Failed to delete links:', linkError.message)
    process.exit(1)
  }
  console.log(`✓ Deleted ${linkCount ?? 0} link(s)`)

  // 5. Delete bookings
  const { error: bookingError } = await supabase
    .from('cad_yip_bookings')
    .delete()
    .in('id', bookingIds)

  if (bookingError) {
    console.error('Failed to delete bookings:', bookingError.message)
    process.exit(1)
  }
  console.log(`✓ Deleted ${bookings.length} booking(s)`)

  console.log('\nDone.')
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
