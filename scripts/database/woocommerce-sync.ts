#!/usr/bin/env ts-node

/**
 * WooCommerce to Supabase Sync Script
 *
 * Syncs booking data from WooCommerce to Supabase tables:
 * - cad_yip_bookings
 * - cad_yip_attendees
 * - cad_yip_links
 *
 * Usage:
 *   npm run sync:woo -- --from=2024-01-01 --to=2024-12-31
 *   npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --event=CADCNX
 */

// Load environment variables from .env.local
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// Configuration - Use environment variables
const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL || ''
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || ''
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' // Use service key for admin operations

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface SyncStats {
  ordersProcessed: number
  bookingsCreated: number
  bookingsUpdated: number
  attendeesCreated: number
  linksCreated: number
  errors: string[]
}

interface PickupSyncStats {
  ordersProcessed: number
  bookingsUpdated: number
  bookingsSkipped: number
  missingInSupabase: number[]
  errors: string[]
}

interface WooMeta {
  key: string
  value: unknown
}

interface WooOrder {
  id: number
  date_created: string
  status: string
  total: string
  billing: {
    first_name: string
    last_name: string
    email: string
    phone: string
    country: string
  }
  line_items: Array<{
    id: number
    name: string
    sku: string
    quantity: number
    total: string
    meta_data: WooMeta[]
  }>
  meta_data: WooMeta[]
  payment_method: string
  payment_method_title: string
}

interface WooEventTicket {
  WooCommerceEventsAttendeeName?: string
  WooCommerceEventsAttendeeLastName?: string
}

interface SimpleAttendee {
  first_name?: string
  firstname?: string
  last_name?: string
  lastname?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metaAsString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function hasRoyalSilkTransfer(productExtras: unknown): boolean {
  if (!isRecord(productExtras) || !isRecord(productExtras.groups)) return false

  for (const group of Object.values(productExtras.groups)) {
    if (!isRecord(group)) continue
    for (const field of Object.values(group)) {
      if (!isRecord(field)) continue
      const label = typeof field.label === 'string' ? field.label : ''
      if (label.toLowerCase().includes('royal silk') && field.value === '__checked__') {
        return true
      }
    }
  }
  return false
}

/**
 * Fetch orders from WooCommerce REST API
 */
async function fetchWooCommerceOrders(
  dateFrom: string,
  dateTo: string,
  page: number = 1,
  perPage: number = 100
): Promise<WooOrder[]> {
  const auth = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64')

  const params = new URLSearchParams({
    per_page: perPage.toString(),
    page: page.toString(),
    after: new Date(dateFrom).toISOString(),
    before: new Date(dateTo + 'T23:59:59').toISOString(),
    orderby: 'date',
    order: 'asc',
    status: 'completed',
  })

  const url = `${WOOCOMMERCE_URL}/wp-json/wc/v3/orders?${params}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Extract metadata value from WooCommerce meta_data array
 */
function getMetaValue(metaData: WooMeta[], key: string): unknown {
  const meta = metaData.find(m => m.key === key)
  return meta ? meta.value : null
}

/**
 * Parse phone number to E.164 format (simple version)
 */
function parsePhoneNumber(phone: string, country: string = 'TH'): { raw: string; e164: string | null } {
  const raw = phone.replace(/\s+/g, '')

  // Simple E.164 formatting for Thailand (+66)
  // You may need to enhance this based on your needs
  let e164: string | null = null
  if (country === 'TH') {
    const cleaned = raw.replace(/^0+/, '') // Remove leading zeros
    if (cleaned.length >= 9) {
      e164 = `+66${cleaned}`
    }
  }

  return { raw, e164 }
}

/**
 * Infer zone code and zone name from SKU suffix as a fallback
 * e.g. CADNYE2731E → { zoneCode: 'E', zone: 'Elite' }
 */
function inferZoneFromSku(sku: string): { zoneCode: string; zone: string } | null {
  const suffixMap: Record<string, string> = {
    E: 'Elite',
    T: 'Platinum',
    G: 'Gold',
    S: 'Standard',
    B: 'Shabu',
  }
  const suffix = sku.slice(-1).toUpperCase()
  if (suffixMap[suffix]) {
    return { zoneCode: suffix, zone: suffixMap[suffix] }
  }
  return null
}

/**
 * Convert event date from various formats to YYYY-MM-DD
 */
function convertEventDate(dateStr: string): string | null {
  if (!dateStr) return null

  // Handle "25-november-2026" format
  const dateMatch = dateStr.match(/(\d+)-(\w+)-(\d+)/)
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    const monthMap: { [key: string]: string } = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12'
    }
    const monthNum = monthMap[month.toLowerCase()]
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`
    }
  }

  // Handle "2026年11月25日" format (Japanese)
  const jpDateMatch = dateStr.match(/(\d+)年(\d+)月(\d+)日/)
  if (jpDateMatch) {
    const [, year, month, day] = jpDateMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  return null
}

/**
 * Look up commission from cad_yip_prices table based on SKU and booking date
 */
async function lookupCommission(
  sku: string,
  bookingDate: Date
): Promise<number> {
  try {
    // Query all prices for this SKU
    const { data: prices, error } = await supabase
      .from('cad_yip_prices')
      .select('commission_amount, valid_from, valid_to')
      .eq('sku', sku)

    if (error) {
      console.error(`  Error looking up price for SKU ${sku}: ${error.message}`)
      return 0
    }

    if (!prices || prices.length === 0) {
      console.warn(`  No price found for SKU: ${sku}`)
      return 0
    }

    // Find the price valid for the booking date
    for (const price of prices) {
      const validFrom = new Date(price.valid_from)
      const validTo = price.valid_to ? new Date(price.valid_to) : null

      // Check if booking date falls within the valid period
      if (bookingDate >= validFrom && (!validTo || bookingDate <= validTo)) {
        return price.commission_amount
      }
    }

    console.warn(`  No valid price period found for SKU ${sku} on date ${bookingDate.toISOString().split('T')[0]}`)
    return 0
  } catch (error) {
    console.error(`  Error looking up commission: ${error}`)
    return 0
  }
}

/**
 * Calculate fees based on payment method
 */
function calculateFees(total: number, paymentMethod: string): number {
  const method = paymentMethod.toLowerCase()

  // Payment gateway fees - adjust based on your actual gateway rates
  if (method.includes('omise') || method.includes('credit') || method.includes('debit')) {
    return total * 0.029 // Example: 2.9%
  } else if (method.includes('beam')) {
    return total * 0.029 // Example: 2.9%
  } else if (method.includes('paypal')) {
    return total * 0.034 // Example: 3.4%
  } else if (method.includes('bank transfer') || method.includes('direct bank')) {
    return 0 // No fees for direct bank transfer
  }

  return 0
}

/**
 * Sync a single order to Supabase
 */
async function syncOrder(order: WooOrder, stats: SyncStats, dryRun: boolean = false): Promise<void> {
  try {
    console.log(`Processing order #${order.id}${dryRun ? ' [DRY RUN]' : ''}...`)

    // Process each line item as a separate booking
    for (const lineItem of order.line_items) {
      if (!lineItem.sku) {
        console.log(`  Skipping line item without SKU: ${lineItem.name}`)
        continue
      }

      // Extract metadata from line item
      const seat =
        metaAsString(getMetaValue(lineItem.meta_data, 'seat')) ||
        metaAsString(getMetaValue(lineItem.meta_data, 'pa_seat'))

      // Check for RSH transfer by looking at product_extras for "Royal Silk" checkbox
      const isRshTransfer = hasRoyalSilkTransfer(getMetaValue(lineItem.meta_data, 'product_extras'))

      // Extract pickup location from order-level metadata
      const rshPickupLater = getMetaValue(order.meta_data, '_rsh_pickup_later') === '1'
      const rshHotelName = metaAsString(getMetaValue(order.meta_data, '_rsh_hotel_name'))
      const rshPickupType = metaAsString(getMetaValue(order.meta_data, '_rsh_pickup_type'))

      let pickupLoc = ''
      if (isRshTransfer) {
        if (rshPickupLater) {
          pickupLoc = 'Pickup Later - Not Provided Yet'
        } else if (rshHotelName) {
          pickupLoc = rshPickupType === 'hotel' ? `Hotel: ${rshHotelName}` : rshHotelName
        }
      }
      // Fallback to line item metadata if no RSH pickup info
      if (!pickupLoc) {
        pickupLoc =
          metaAsString(getMetaValue(lineItem.meta_data, 'pickup_location')) ||
          metaAsString(getMetaValue(lineItem.meta_data, 'pa_pickup'))
      }

      // Extract event date from pa_date variation
      let eventDate: string | null = metaAsString(getMetaValue(lineItem.meta_data, 'pa_date')) || null
      if (eventDate) {
        // Convert from "25-november-2026" format to "2026-11-25" format
        eventDate = convertEventDate(eventDate)
      }
      if (!eventDate) {
        eventDate =
          metaAsString(getMetaValue(lineItem.meta_data, 'event_date')) ||
          metaAsString(getMetaValue(order.meta_data, 'event_date')) ||
          null
      }

      const metaZoneCode =
        metaAsString(getMetaValue(lineItem.meta_data, 'zone_code')) ||
        metaAsString(getMetaValue(lineItem.meta_data, 'pa_zone'))
      const metaZone =
        metaAsString(getMetaValue(lineItem.meta_data, 'zone')) ||
        metaAsString(getMetaValue(lineItem.meta_data, 'pa_zone_name'))
      const inferredZone = (!metaZoneCode || !metaZone) ? inferZoneFromSku(lineItem.sku) : null
      const zoneCode = metaZoneCode || inferredZone?.zoneCode || null
      const zone = metaZone || inferredZone?.zone || null
      const eventType =
        metaAsString(getMetaValue(lineItem.meta_data, 'event_type')) ||
        metaAsString(getMetaValue(order.meta_data, 'event_type')) ||
        null

      // Parse phone number
      const phone = parsePhoneNumber(order.billing.phone, order.billing.country)

      // Look up commission from database based on SKU and booking date
      const itemTotal = parseFloat(lineItem.total)
      const bookingDate = new Date(order.date_created)
      const commission = await lookupCommission(lineItem.sku, bookingDate)
      const fees = calculateFees(itemTotal, order.payment_method)

      // Check if booking already exists
      const { data: existingBooking } = await supabase
        .from('cad_yip_bookings')
        .select('id')
        .eq('woo_id', order.id)
        .eq('sku', lineItem.sku)
        .single()

      const bookingData = {
        woo_id: order.id,
        firstname: order.billing.first_name,
        lastname: order.billing.last_name,
        email: order.billing.email,
        phone_raw: phone.raw,
        phone_e164: phone.e164,
        country: order.billing.country,
        sku: lineItem.sku,
        seat,
        is_rsh_transfer: isRshTransfer,
        pickup_loc: pickupLoc,
        amount: itemTotal,
        commission,
        fees,
        gateway: order.payment_method_title,
        event_date: eventDate,
        zone_code: zoneCode,
        zone,
        event_type: eventType,
      }

      let bookingId: number

      if (existingBooking) {
        bookingId = existingBooking.id

        if (dryRun) {
          console.log(`  [DRY RUN] Would update booking ID: ${bookingId}`)
          console.log(`    Data:`, JSON.stringify(bookingData, null, 2))
        } else {
          // Update existing booking
          const { error } = await supabase
            .from('cad_yip_bookings')
            .update(bookingData)
            .eq('id', existingBooking.id)

          if (error) throw error
          console.log(`  Updated booking ID: ${bookingId}`)
        }
        stats.bookingsUpdated++
      } else {
        if (dryRun) {
          bookingId = 0 // Placeholder for dry run
          console.log(`  [DRY RUN] Would create new booking`)
          console.log(`    Data:`, JSON.stringify(bookingData, null, 2))
        } else {
          // Create new booking
          const { data, error } = await supabase
            .from('cad_yip_bookings')
            .insert(bookingData)
            .select('id')
            .single()

          if (error) throw error
          bookingId = data.id
          console.log(`  Created booking ID: ${bookingId}`)
        }
        stats.bookingsCreated++
      }

      // Sync attendees from WooCommerceEventsOrderTickets
      const wooEventsTickets = getMetaValue(order.meta_data, 'WooCommerceEventsOrderTickets')
      const attendees: Array<{ firstname: string; lastname: string }> = []

      if (isRecord(wooEventsTickets)) {
        // Iterate through line items in the events tickets structure
        Object.values(wooEventsTickets).forEach((lineItemTickets) => {
          if (isRecord(lineItemTickets)) {
            // Iterate through individual ticket holders
            Object.values(lineItemTickets).forEach((ticketValue) => {
              if (!isRecord(ticketValue)) return
              const ticket = ticketValue as WooEventTicket
              if (ticket.WooCommerceEventsAttendeeName) {
                attendees.push({
                  firstname: ticket.WooCommerceEventsAttendeeName || '',
                  lastname: ticket.WooCommerceEventsAttendeeLastName || '',
                })
              }
            })
          }
        })
      }

      // Fallback to simpler attendee structure if WooCommerceEvents not found
      if (attendees.length === 0) {
        const simpleAttendees =
          getMetaValue(lineItem.meta_data, 'attendees') ??
          getMetaValue(lineItem.meta_data, '_attendees') ??
          []
        if (Array.isArray(simpleAttendees)) {
          simpleAttendees.forEach((attendeeValue) => {
            if (!isRecord(attendeeValue)) return
            const attendee = attendeeValue as SimpleAttendee
            attendees.push({
              firstname: attendee.first_name || attendee.firstname || '',
              lastname: attendee.last_name || attendee.lastname || '',
            })
          })
        }
      }

      if (attendees.length > 0) {
        if (dryRun) {
          console.log(`  [DRY RUN] Would delete existing attendees for booking ID: ${bookingId}`)
          console.log(`  [DRY RUN] Would create ${attendees.length} attendees:`)
          attendees.forEach((attendee, idx) => {
            console.log(`    ${idx + 1}. ${attendee.firstname} ${attendee.lastname}`)
          })
          stats.attendeesCreated += attendees.length
        } else {
          // Delete existing attendees for this booking
          await supabase
            .from('cad_yip_attendees')
            .delete()
            .eq('booking_id', bookingId)

          // Insert new attendees
          for (const attendee of attendees) {
            const { error } = await supabase
              .from('cad_yip_attendees')
              .insert({
                booking_id: bookingId,
                attendee_firstname: attendee.firstname,
                attendee_lastname: attendee.lastname,
              })

            if (error) {
              console.error(`  Error creating attendee: ${error.message}`)
            } else {
              stats.attendeesCreated++
            }
          }
        }
      }

      // Sync eticket links from _mtp_eticket_urls
      const eticketUrls = getMetaValue(order.meta_data, '_mtp_eticket_urls')
      let links: string[] = []

      if (Array.isArray(eticketUrls) && eticketUrls.length > 0) {
        links = eticketUrls.filter((url): url is string => typeof url === 'string' && url.trim() !== '')
      }

      // Fallback to other link metadata
      if (links.length === 0) {
        const fallbackLinks =
          getMetaValue(lineItem.meta_data, 'links') ??
          getMetaValue(lineItem.meta_data, '_links') ??
          getMetaValue(order.meta_data, 'booking_links') ??
          []
        if (Array.isArray(fallbackLinks)) {
          links = fallbackLinks
            .map((link): string | null => {
              if (typeof link === 'string') return link
              if (isRecord(link) && typeof link.url === 'string') return link.url
              return null
            })
            .filter((url): url is string => Boolean(url))
        }
      }

      if (links.length > 0) {
        if (dryRun) {
          console.log(`  [DRY RUN] Would delete existing links for booking ID: ${bookingId}`)
          console.log(`  [DRY RUN] Would create ${links.length} links:`)
          links.forEach((url, idx) => {
            console.log(`    ${idx + 1}. ${url}`)
          })
          stats.linksCreated += links.length
        } else {
          // Delete existing links for this booking
          await supabase
            .from('cad_yip_links')
            .delete()
            .eq('booking_id', bookingId)

          // Insert new links
          for (const url of links) {
            if (url) {
              const { error } = await supabase
                .from('cad_yip_links')
                .insert({
                  booking_id: bookingId,
                  url,
                })

              if (error) {
                console.error(`  Error creating link: ${error.message}`)
              } else {
                stats.linksCreated++
              }
            }
          }
        }
      }
    }

    stats.ordersProcessed++
  } catch (error) {
    const errorMsg = `Error processing order #${order.id}: ${error}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
  }
}

/**
 * Main sync function
 */
async function syncWooCommerce(
  dateFrom: string,
  dateTo: string,
  eventFilter?: string,
  dryRun: boolean = false,
  limit?: number
): Promise<void> {
  console.log('='.repeat(60))
  console.log(`WooCommerce to Supabase Sync${dryRun ? ' [DRY RUN MODE]' : ''}`)
  console.log('='.repeat(60))
  console.log(`Date Range: ${dateFrom} to ${dateTo}`)
  if (eventFilter) {
    console.log(`Event Filter: ${eventFilter}`)
  }
  if (limit) {
    console.log(`Limit: ${limit} orders`)
  }
  if (dryRun) {
    console.log('')
    console.log('⚠️  DRY RUN MODE - No changes will be made to the database')
    console.log('⚠️  This preview shows what WOULD happen')
  }
  console.log('')

  // Validate configuration
  if (!WOOCOMMERCE_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    throw new Error('Missing WooCommerce configuration. Please set WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET')
  }

  if (!dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    throw new Error('Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY')
  }

  const stats: SyncStats = {
    ordersProcessed: 0,
    bookingsCreated: 0,
    bookingsUpdated: 0,
    attendeesCreated: 0,
    linksCreated: 0,
    errors: [],
  }

  try {
    let page = 1
    let hasMore = true

    while (hasMore) {
      console.log(`Fetching page ${page}...`)
      const orders = await fetchWooCommerceOrders(dateFrom, dateTo, page)

      if (orders.length === 0) {
        hasMore = false
        break
      }

      console.log(`Found ${orders.length} orders on page ${page}`)

      for (const order of orders) {
        // Check if we've reached the limit
        if (limit && stats.ordersProcessed >= limit) {
          console.log(`\nReached limit of ${limit} orders. Stopping sync.`)
          hasMore = false
          break
        }

        // Apply event filter if specified
        if (eventFilter) {
          const hasMatchingSKU = order.line_items.some(item =>
            item.sku?.toUpperCase().includes(eventFilter.toUpperCase())
          )
          if (!hasMatchingSKU) {
            console.log(`Skipping order #${order.id} (no matching event SKU)`)
            continue
          }
        }

        await syncOrder(order, stats, dryRun)
      }

      page++
    }

    console.log('')
    console.log('='.repeat(60))
    console.log(`Sync Complete${dryRun ? ' [DRY RUN]' : ''}`)
    console.log('='.repeat(60))
    if (dryRun) {
      console.log('⚠️  DRY RUN - No changes were made to the database')
      console.log('')
    }
    console.log(`Orders Processed: ${stats.ordersProcessed}`)
    console.log(`Bookings Created: ${stats.bookingsCreated}`)
    console.log(`Bookings Updated: ${stats.bookingsUpdated}`)
    console.log(`Attendees Created: ${stats.attendeesCreated}`)
    console.log(`Links Created: ${stats.linksCreated}`)

    if (stats.errors.length > 0) {
      console.log(`Errors: ${stats.errors.length}`)
      console.log('')
      console.log('Error Details:')
      stats.errors.forEach(error => console.log(`  - ${error}`))
    }
  } catch (error) {
    console.error('Sync failed:', error)
    throw error
  }
}

/**
 * Update only the pickup_loc field for RSH transfer line items in a single order.
 * Does not touch any other booking fields.
 */
async function syncOrderPickupOnly(order: WooOrder, stats: PickupSyncStats, dryRun: boolean = false): Promise<void> {
  try {
    console.log(`Processing order #${order.id}${dryRun ? ' [DRY RUN]' : ''}...`)

    // Extract pickup info from order-level metadata (same logic as full sync)
    const rshPickupLater = getMetaValue(order.meta_data, '_rsh_pickup_later') === '1'
    const rshHotelName = metaAsString(getMetaValue(order.meta_data, '_rsh_hotel_name'))
    const rshPickupType = metaAsString(getMetaValue(order.meta_data, '_rsh_pickup_type'))

    let hasRshLineItem = false

    for (const lineItem of order.line_items) {
      if (!lineItem.sku) continue

      // Check if this line item is an RSH transfer
      const isRshTransfer = hasRoyalSilkTransfer(getMetaValue(lineItem.meta_data, 'product_extras'))

      if (!isRshTransfer) {
        console.log(`  Skipping line item ${lineItem.sku} (not RSH transfer)`)
        continue
      }

      hasRshLineItem = true

      // Determine pickup location
      let pickupLoc = ''
      if (rshPickupLater) {
        pickupLoc = 'Pickup Later - Not Provided Yet'
      } else if (rshHotelName) {
        pickupLoc = rshPickupType === 'hotel' ? `Hotel: ${rshHotelName}` : rshHotelName
      }

      // Fallback to line item metadata if no RSH pickup info
      if (!pickupLoc) {
        pickupLoc =
          metaAsString(getMetaValue(lineItem.meta_data, 'pickup_location')) ||
          metaAsString(getMetaValue(lineItem.meta_data, 'pa_pickup'))
      }

      // Find the existing booking
      const { data: existingBooking, error: lookupError } = await supabase
        .from('cad_yip_bookings')
        .select('id, pickup_loc')
        .eq('woo_id', order.id)
        .eq('sku', lineItem.sku)
        .single()

      if (lookupError || !existingBooking) {
        console.log(`  No booking found for order #${order.id} sku ${lineItem.sku} — skipping`)
        if (!stats.missingInSupabase.includes(order.id)) {
          stats.missingInSupabase.push(order.id)
        }
        stats.bookingsSkipped++
        continue
      }

      // Only update if pickup_loc is currently empty or null
      if (existingBooking.pickup_loc) {
        console.log(`  Booking ID ${existingBooking.id} already has pickup_loc — skipping`)
        stats.bookingsSkipped++
        continue
      }

      const oldVal = existingBooking.pickup_loc ?? '(null)'

      if (dryRun) {
        console.log(`  [DRY RUN] Would update booking ID ${existingBooking.id}: pickup_loc "${oldVal}" → "${pickupLoc}"`)
        stats.bookingsUpdated++
      } else {
        const { error } = await supabase
          .from('cad_yip_bookings')
          .update({ pickup_loc: pickupLoc })
          .eq('id', existingBooking.id)

        if (error) throw error
        console.log(`  Updated booking ID ${existingBooking.id}: pickup_loc "${oldVal}" → "${pickupLoc}"`)
        stats.bookingsUpdated++
      }
    }

    if (!hasRshLineItem) {
      console.log(`  No RSH transfer line items — skipping order`)
      return
    }

    stats.ordersProcessed++
  } catch (error) {
    const errorMsg = `Error processing order #${order.id}: ${error}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
  }
}

/**
 * Sync pickup locations only — queries WooCommerce orders, filters to RSH transfer
 * line items, and updates only the pickup_loc field in Supabase.
 */
async function syncPickupOnly(
  dateFrom: string,
  dateTo: string,
  eventFilter?: string,
  dryRun: boolean = false,
  limit?: number
): Promise<void> {
  console.log('='.repeat(60))
  console.log(`RSH Pickup-Only Sync${dryRun ? ' [DRY RUN MODE]' : ''}`)
  console.log('='.repeat(60))
  console.log(`Date Range: ${dateFrom} to ${dateTo}`)
  if (eventFilter) console.log(`Event Filter: ${eventFilter}`)
  if (limit) console.log(`Limit: ${limit} orders`)
  if (dryRun) {
    console.log('')
    console.log('⚠️  DRY RUN MODE - No changes will be made to the database')
  }
  console.log('')

  if (!WOOCOMMERCE_URL || !WOOCOMMERCE_CONSUMER_KEY || !WOOCOMMERCE_CONSUMER_SECRET) {
    throw new Error('Missing WooCommerce configuration.')
  }
  if (!dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    throw new Error('Missing Supabase configuration.')
  }

  const stats: PickupSyncStats = {
    ordersProcessed: 0,
    bookingsUpdated: 0,
    bookingsSkipped: 0,
    missingInSupabase: [],
    errors: [],
  }

  let page = 1
  let hasMore = true
  let totalFetched = 0

  while (hasMore) {
    console.log(`Fetching page ${page}...`)
    const orders = await fetchWooCommerceOrders(dateFrom, dateTo, page)

    if (orders.length === 0) {
      hasMore = false
      break
    }

    console.log(`Found ${orders.length} orders on page ${page}`)

    for (const order of orders) {
      if (limit && totalFetched >= limit) {
        console.log(`\nReached limit of ${limit} orders. Stopping.`)
        hasMore = false
        break
      }

      if (eventFilter) {
        const hasMatchingSKU = order.line_items.some(item =>
          item.sku?.toUpperCase().includes(eventFilter.toUpperCase())
        )
        if (!hasMatchingSKU) {
          console.log(`Skipping order #${order.id} (no matching event SKU)`)
          continue
        }
      }

      await syncOrderPickupOnly(order, stats, dryRun)
      totalFetched++
    }

    page++
  }

  console.log('')
  console.log('='.repeat(60))
  console.log(`Pickup Sync Complete${dryRun ? ' [DRY RUN]' : ''}`)
  console.log('='.repeat(60))
  if (dryRun) console.log('⚠️  DRY RUN - No changes were made to the database\n')
  console.log(`Orders Processed (with RSH): ${stats.ordersProcessed}`)
  console.log(`Bookings Updated:            ${stats.bookingsUpdated}`)
  console.log(`Bookings Skipped:            ${stats.bookingsSkipped}`)

  if (stats.missingInSupabase.length > 0) {
    console.log('')
    console.log(`⚠️  Completed WooCommerce orders not found in Supabase (${stats.missingInSupabase.length}):`)
    stats.missingInSupabase.forEach(id => console.log(`  - Order #${id}`))
  }

  if (stats.errors.length > 0) {
    console.log('')
    console.log(`Errors: ${stats.errors.length}`)
    console.log('Error Details:')
    stats.errors.forEach(e => console.log(`  - ${e}`))
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : undefined
}
const hasFlag = (name: string): boolean => {
  return args.includes(`--${name}`)
}

const dateFrom = getArg('from')
const dateTo = getArg('to')
const eventFilter = getArg('event')
const limitStr = getArg('limit')
const limit = limitStr ? parseInt(limitStr, 10) : undefined
const dryRun = hasFlag('dry-run')
const pickupOnly = hasFlag('pickup-only')

if (!dateFrom || !dateTo) {
  console.error('Usage: npm run sync:woo -- --from=YYYY-MM-DD --to=YYYY-MM-DD [OPTIONS]')
  console.error('')
  console.error('Options:')
  console.error('  --from=DATE        Start date (YYYY-MM-DD)')
  console.error('  --to=DATE          End date (YYYY-MM-DD)')
  console.error('  --event=CODE       Filter by event code (CADCNX or CADNYE)')
  console.error('  --limit=N          Process maximum N orders (useful for testing)')
  console.error('  --dry-run          Preview changes without writing to database')
  console.error('  --pickup-only      Update only pickup_loc for RSH transfer bookings')
  console.error('')
  console.error('Examples:')
  console.error('  npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --dry-run')
  console.error('  npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --event=CADCNX --limit=5')
  console.error('  npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --pickup-only --dry-run')
  process.exit(1)
}

// Run sync
const runner = pickupOnly
  ? syncPickupOnly(dateFrom, dateTo, eventFilter, dryRun, limit)
  : syncWooCommerce(dateFrom, dateTo, eventFilter, dryRun, limit)

runner
  .then(() => {
    console.log('✓ Sync completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('✗ Sync failed:', error)
    process.exit(1)
  })
