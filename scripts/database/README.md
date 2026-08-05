# Database Operations

This directory contains scripts for database operations and data synchronization.

## WooCommerce Sync

The `woocommerce-sync.ts` script syncs booking data from WooCommerce to Supabase.

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**

   Add the following to your `.env.local` file:

   ```env
   # WooCommerce API Configuration
   WOOCOMMERCE_URL=https://your-store.com
   WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxx
   WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxx

   # Supabase Configuration (for sync operations)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   ```

   **Important:** Use the Supabase **service role key** (not anon key) for sync operations, as it has admin permissions.

### Usage

#### Sync all orders in a date range
```bash
npm run sync:woo -- --from=2024-01-01 --to=2024-12-31
```

#### Sync orders for a specific event
```bash
# Sync only CADCNX (Yipeng) orders
npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --event=CADCNX

# Sync only CADNYE (New Year) orders
npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --event=CADNYE
```

#### Sync recent orders (last 7 days)
```bash
npm run sync:woo -- --from=2024-12-01 --to=2024-12-07
```

#### Dry run (preview without making changes)
```bash
# Preview what will be synced without modifying the database
npm run sync:woo -- --from=2024-01-01 --to=2024-12-31 --dry-run

# Combine with event filter
npm run sync:woo -- --from=2025-12-01 --to=2025-12-31 --event=CADCNX --dry-run
```

**Dry Run Mode**:
- ⚠️ **No database changes are made**
- Shows exactly what would be created/updated
- Displays full booking data for each order
- Lists all attendees and links that would be synced
- Perfect for testing before running the actual sync
- Use this first to verify the sync will work correctly

### Row Level Security (RLS)

Supabase warns when tables are unrestricted. Enable RLS for all `cad_yip_*` tables:

```bash
# scripts/database/enable-rls.sql
```

| Role | Access |
|------|--------|
| `anon` (publishable key, not logged in) | **Denied** |
| `authenticated` (dashboard login) | Full CRUD |
| `service_role` (`SUPABASE_SERVICE_KEY`) | Bypasses RLS (Woo sync) |

After RLS: **stay logged in** for the app. For `npm run sync:woo`, set **`SUPABASE_SERVICE_KEY`** (service role) in `.env.local` so the script is not blocked.

### Refunds (completed + refunded + cancelled)

Apply schema first (Supabase SQL editor or `psql`):

```bash
# 1) scripts/database/add-refunds.sql
# 2) scripts/database/enable-rls.sql
```

Then sync as usual. The script:

- Fetches `status=completed,refunded,cancelled`
- Loads `/orders/{id}/refunds` when status is refunded/cancelled **or** `order.refunds[]` is non-empty
- Upserts `cad_yip_refunds` + `cad_yip_refund_items`
- Sets booking `is_cancelled=true` for **any** refund (partial or full), including `completed` + refund evidence
- Keeps dashboard cancel via `cancel_source=dashboard` sticky

### What Gets Synced

The script syncs data to:

1. **cad_yip_bookings**
   - Order and customer information
   - Pricing, commission, and fees
   - Event details (date, type, zone)
   - Seat and pickup information
   - Refund flags: `woo_status`, `refund_status`, `amount_refunded`, `amount_net`, `is_cancelled`
2. **cad_yip_refunds** / **cad_yip_refund_items** — Woo refund ledger

2. **cad_yip_attendees**
   - Attendee names for each booking
   - Linked to bookings via `booking_id`

3. **cad_yip_links**
   - Associated URLs/links for bookings
   - Linked to bookings via `booking_id`

### How It Works

1. **Fetches orders** from WooCommerce REST API within the specified date range
2. **Processes each line item** as a separate booking (since one order can have multiple tickets)
3. **Checks for existing bookings** using `woo_id` and `sku` to avoid duplicates
4. **Updates or inserts** booking data
5. **Syncs related data**:
   - Deletes and recreates attendees (to ensure accuracy)
   - Deletes and recreates links (to ensure accuracy)

### WooCommerce Metadata Mapping

The script extracts the following metadata from orders and line items:

| Field | Metadata Keys / Logic |
|-------|----------------------|
| Seat | `seat`, `pa_seat` from line item |
| RSH Transfer | Detected by checking `product_extras.groups` for "Royal Silk" checkbox with value `__checked__` |
| Pickup Location | **If RSH Transfer purchased:**<br>- `_rsh_pickup_later=1` → "Pickup Later - Not Provided Yet"<br>- `_rsh_hotel_name` → "Hotel: [name]" (when `_rsh_pickup_type=hotel`)<br>- Falls back to `pickup_location`, `pa_pickup` from line item |
| Event Date | `pa_date` from line item variations (converted from "25-november-2026" or Japanese formats to "YYYY-MM-DD")<br>Falls back to: `event_date` (line item or order) |
| Zone Code | `zone_code`, `pa_zone` from line item |
| Zone | `zone`, `pa_zone_name` from line item |
| Event Type | `event_type` (line item or order) |
| Attendees | Extracted from `WooCommerceEventsOrderTickets` structure at order level<br>Falls back to: `attendees`, `_attendees` |
| Links | Extracted from `_mtp_eticket_urls` at order level<br>Falls back to: `links`, `_links`, `booking_links` |

### RSH Transfer Handling

The script properly handles Royal Silk Hotel (RSH) transfer bookings:

**Detection**: Checks if "Royal Silk" appears in product extras with checkbox marked

**Pickup Location Scenarios**:
1. **Pickup Later**: When `_rsh_pickup_later=1`, stores "Pickup Later - Not Provided Yet"
2. **Pickup Provided**: When `_rsh_hotel_name` exists, stores hotel name (e.g., "Hotel: AMANOR Hotel Chiang Mai")
3. **No RSH Transfer**: Uses standard pickup location fields

### Commission and Fees Calculation

The script includes placeholder logic for calculating commission and fees. **You should customize this** based on your business rules:

```typescript
// Located around line 135 in woocommerce-sync.ts
function calculateCommissionAndFees(
  total: number,
  paymentMethod: string,
  sku: string
): { commission: number; fees: number } {
  // TODO: Customize this logic for your business
  // You may want to look up commission rates from cad_yip_prices table
}
```

### Output Example

```
============================================================
WooCommerce to Supabase Sync
============================================================
Date Range: 2024-01-01 to 2024-12-31
Event Filter: CADCNX

Fetching page 1...
Found 100 orders on page 1
Processing order #12345...
  Created booking ID: 1001

Fetching page 2...
Found 45 orders on page 2
Processing order #12346...
  Updated booking ID: 1002

============================================================
Sync Complete
============================================================
Orders Processed: 145
Bookings Created: 120
Bookings Updated: 25
Attendees Created: 340
Links Created: 145
```

#### Dry Run Output Example

```
============================================================
WooCommerce to Supabase Sync [DRY RUN MODE]
============================================================
Date Range: 2024-01-01 to 2024-01-31
Event Filter: CADCNX

⚠️  DRY RUN MODE - No changes will be made to the database
⚠️  This preview shows what WOULD happen

Fetching page 1...
Found 5 orders on page 1
Processing order #12345 [DRY RUN]...
  [DRY RUN] Would create new booking
    Data: {
      "woo_id": 12345,
      "firstname": "John",
      "lastname": "Doe",
      "email": "john@example.com",
      "sku": "CADCNX2625G",
      "is_rsh_transfer": true,
      "pickup_loc": "Hotel: Example Hotel",
      ...
    }
  [DRY RUN] Would delete existing attendees for booking ID: 0
  [DRY RUN] Would create 2 attendees:
    1. John Doe
    2. Jane Smith
  [DRY RUN] Would delete existing links for booking ID: 0
  [DRY RUN] Would create 1 links:
    1. https://got.ee/ticket/abc123

============================================================
Sync Complete [DRY RUN]
============================================================
⚠️  DRY RUN - No changes were made to the database

Orders Processed: 5
Bookings Created: 5
Bookings Updated: 0
Attendees Created: 10
Links Created: 5
```

### Error Handling

- Failed orders are logged but don't stop the sync
- Errors are collected and displayed at the end
- Exit code 0 on success, 1 on failure

### Troubleshooting

**"Missing WooCommerce configuration" error**
- Ensure all WooCommerce environment variables are set in `.env.local`

**"WooCommerce API error: 401"**
- Check your consumer key and secret
- Ensure your WooCommerce REST API is enabled

**"Missing Supabase configuration" error**
- Ensure SUPABASE_SERVICE_KEY is set (not just the anon key)

**No orders found**
- Check your date range
- Verify orders exist in WooCommerce for that period
- Check event filter matches your SKU format

**Commission/fees are incorrect**
- Update the `calculateCommissionAndFees()` function
- Consider looking up rates from the `cad_yip_prices` table

## Best Practices

1. **Always dry run first**: Use `--dry-run` to preview what will be synced before making changes
2. **Test with small range**: Run on a small date range to verify the sync works correctly
3. **Backup data**: Always backup your Supabase database before running large syncs
4. **Monitor output**: Check the sync output for errors and verify the data looks correct
5. **Schedule carefully**: Don't run during peak traffic times
6. **Event-specific syncs**: Use `--event` filter when syncing specific events to save time

## Security Notes

- Never commit `.env.local` to version control
- Use service role key only in secure environments
- Rotate API keys regularly
- Restrict service key permissions if possible
