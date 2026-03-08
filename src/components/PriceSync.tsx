'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Booking, Price } from '@/types/database'

interface PriceSyncProps {
  eventCode: 'CADCNX' | 'CADNYE'
  eventName: string
  onSyncComplete: () => void
}

interface SyncResult {
  success: number
  skipped: number
  errors: number
  details: string[]
}

export function PriceSync({ eventCode, eventName, onSyncComplete }: PriceSyncProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [syncAll, setSyncAll] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  const handleSyncClick = () => {
    setShowConfirm(true)
    setSyncResult(null)
  }

  const handleConfirmSync = async () => {
    setShowConfirm(false)
    setIsSyncing(true)
    setSyncResult(null)

    try {
      const result: SyncResult = {
        success: 0,
        skipped: 0,
        errors: 0,
        details: []
      }

      // Step 1: Fetch all prices from cad_yip_prices
      const { data: prices, error: pricesError } = await supabase
        .from('cad_yip_prices')
        .select('*')

      if (pricesError) {
        throw new Error(`Failed to fetch prices: ${pricesError.message}`)
      }

      if (!prices || prices.length === 0) {
        result.details.push('No prices found in database')
        setSyncResult(result)
        setIsSyncing(false)
        return
      }

      // Create a map of SKU to prices for quick lookup
      const priceMap = new Map<string, Price[]>()
      prices.forEach((price) => {
        if (!priceMap.has(price.sku)) {
          priceMap.set(price.sku, [])
        }
        priceMap.get(price.sku)!.push(price)
      })

      // Step 2: Fetch bookings to sync
      let query = supabase
        .from('cad_yip_bookings')
        .select('*')
        .like('sku', `%${eventCode}%`)

      // Apply date filters if not syncing all
      if (!syncAll) {
        if (dateFrom) {
          query = query.gte('created_at', new Date(dateFrom).toISOString())
        }
        if (dateTo) {
          const endDate = new Date(dateTo)
          endDate.setHours(23, 59, 59, 999)
          query = query.lte('created_at', endDate.toISOString())
        }
      }

      const { data: bookings, error: bookingsError } = await query

      if (bookingsError) {
        throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
      }

      if (!bookings || bookings.length === 0) {
        result.details.push('No bookings found to sync')
        setSyncResult(result)
        setIsSyncing(false)
        return
      }

      result.details.push(`Found ${bookings.length} bookings to process`)

      // Step 3: Update each booking with correct price
      for (const booking of bookings) {
        try {
          if (!booking.sku) {
            result.skipped++
            continue
          }

          // Find matching price for this SKU
          const skuPrices = priceMap.get(booking.sku)
          if (!skuPrices || skuPrices.length === 0) {
            result.skipped++
            result.details.push(`No price found for SKU: ${booking.sku} (Booking #${booking.woo_id})`)
            continue
          }

          // Find the valid price based on booking created_at
          const bookingDate = new Date(booking.created_at || new Date())
          let validPrice: Price | null = null

          for (const price of skuPrices) {
            const validFrom = new Date(price.valid_from)
            const validTo = price.valid_to ? new Date(price.valid_to) : null

            if (bookingDate >= validFrom && (!validTo || bookingDate <= validTo)) {
              validPrice = price
              break
            }
          }

          if (!validPrice) {
            result.skipped++
            result.details.push(`No valid price period for SKU: ${booking.sku} (Booking #${booking.woo_id})`)
            continue
          }

          // Calculate new commission value from price table
          const newCommission = validPrice.commission_amount

          // Update booking if commission changed
          if (booking.commission !== newCommission) {
            const { error: updateError } = await supabase
              .from('cad_yip_bookings')
              .update({
                commission: newCommission,
              })
              .eq('id', booking.id)

            if (updateError) {
              result.errors++
              result.details.push(`Failed to update Booking #${booking.woo_id}: ${updateError.message}`)
            } else {
              result.success++
            }
          } else {
            result.skipped++
          }
        } catch (error) {
          result.errors++
          result.details.push(`Error processing Booking #${booking.woo_id}: ${error}`)
        }
      }

      setSyncResult(result)

      // Refresh dashboard data after successful sync
      if (result.success > 0) {
        onSyncComplete()
      }
    } catch (error) {
      setSyncResult({
        success: 0,
        skipped: 0,
        errors: 1,
        details: [`Sync failed: ${error}`]
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Commission Sync - {eventName}</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          Update booking commissions from the price database
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Date Range Filter */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={syncAll}
              onChange={(e) => setSyncAll(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Sync All Bookings</span>
          </label>
        </div>

        {!syncAll && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
        )}

        {/* Sync Button */}
        <div>
          <button
            onClick={handleSyncClick}
            disabled={isSyncing || (!syncAll && !dateFrom && !dateTo)}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              'Run Commission Sync'
            )}
          </button>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className="mt-4 p-4 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)]">
            <h4 className="font-semibold mb-2">Sync Results</h4>
            <div className="space-y-1 text-sm">
              <p className="text-[var(--success)]">✓ Updated: {syncResult.success}</p>
              <p className="text-[var(--foreground-secondary)]">○ Skipped: {syncResult.skipped}</p>
              {syncResult.errors > 0 && (
                <p className="text-[var(--warning)]">✗ Errors: {syncResult.errors}</p>
              )}
            </div>
            {syncResult.details.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-[var(--primary)] hover:underline">
                  View Details ({syncResult.details.length})
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs">
                  {syncResult.details.map((detail, idx) => (
                    <p key={idx} className="text-[var(--foreground-secondary)]">{detail}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--background)] rounded-lg shadow-xl max-w-md w-full border border-[var(--border)]">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 text-[var(--foreground)]">
                Confirm Commission Sync
              </h3>
              <div className="space-y-3 text-sm text-[var(--foreground-secondary)]">
                <p>
                  This will update booking commissions from the database for <strong>{eventName}</strong>.
                </p>
                <p>
                  {syncAll ? (
                    <span className="text-[var(--warning)] font-medium">
                      All bookings will be processed.
                    </span>
                  ) : (
                    <>
                      Date range: <strong>{dateFrom || 'Start'}</strong> to <strong>{dateTo || 'End'}</strong>
                    </>
                  )}
                </p>
                <p className="text-[var(--warning)]">
                  ⚠️ This action will modify the database. Are you sure?
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSync}
                  className="btn-primary flex-1"
                >
                  Confirm & Sync
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
