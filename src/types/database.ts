export type Database = {
    public: {
        Tables: {
            cad_yip_bookings: {
                Row: {
                    id: number
                    created_at: string | null
                    /** Woo order.date_created — sales metrics; not Supabase insert time */
                    order_created_at: string | null
                    woo_id: number
                    firstname: string
                    lastname: string
                    email: string
                    phone_raw: string | null
                    phone_e164: string | null
                    country: string | null
                    sku: string | null
                    seat: string | null
                    is_rsh_transfer: boolean
                    pickup_loc: string | null
                    amount: number
                    commission: number
                    fees: number
                    gateway: string | null
                    event_date: string | null
                    zone_code: string | null
                    zone: string | null
                    event_type: string | null
                    is_cancelled: boolean
                    quantity: number | null
                    pickup_type: string | null
                    pickup_link: string | null
                    amount_refunded: number
                    amount_net: number | null
                    woo_status: string | null
                    refund_status: 'none' | 'partial' | 'full'
                    cancel_source: 'woo' | 'dashboard' | 'system' | null
                    cancelled_at: string | null
                    refunded_at: string | null
                    last_synced_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_bookings']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_bookings']['Row']>
            }
            cad_yip_refunds: {
                Row: {
                    id: number
                    created_at: string
                    woo_order_id: number
                    woo_refund_id: number
                    woo_status: string | null
                    amount: number
                    reason: string | null
                    refunded_at: string | null
                    refunded_by: number | null
                    refunded_payment: boolean | null
                    raw: Record<string, unknown> | null
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_refunds']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_refunds']['Row']>
            }
            cad_yip_refund_items: {
                Row: {
                    id: number
                    created_at: string
                    refund_id: number
                    woo_refund_id: number
                    woo_order_id: number
                    woo_line_item_id: number | null
                    sku: string | null
                    product_name: string | null
                    quantity: number | null
                    line_total: number
                    booking_id: number | null
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_refund_items']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_refund_items']['Row']>
            }
            cad_yip_attendees: {
                Row: {
                    id: number
                    booking_id: number
                    attendee_firstname: string
                    attendee_lastname: string
                    created_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_attendees']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_attendees']['Row']>
            }
            cad_yip_links: {
                Row: {
                    id: number
                    booking_id: number
                    url: string
                    created_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_links']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_links']['Row']>
            }
            cad_yip_prices: {
                Row: {
                    id: number
                    sku: string
                    sell_price: number
                    commission_amount: number
                    currency: string
                    valid_from: string
                    valid_to: string | null
                    created_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_prices']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_prices']['Row']>
            }
        }
    }
}

export type Booking = Database['public']['Tables']['cad_yip_bookings']['Row']
export type Refund = Database['public']['Tables']['cad_yip_refunds']['Row']
export type RefundItem = Database['public']['Tables']['cad_yip_refund_items']['Row']
export type Attendee = Database['public']['Tables']['cad_yip_attendees']['Row']
export type Link = Database['public']['Tables']['cad_yip_links']['Row']
export type Price = Database['public']['Tables']['cad_yip_prices']['Row']

export type RefundStatus = Booking['refund_status']
export type CancelSource = NonNullable<Booking['cancel_source']>

/** Nested attendee shape returned from Supabase selects */
export type AttendeeName = Pick<Attendee, 'id' | 'attendee_firstname' | 'attendee_lastname'>

export type BookingWithAttendees = Booking & {
    cad_yip_attendees?: AttendeeName[] | null
}

export type BookingWithDetails = Booking & {
    attendees: Attendee[]
    links: Link[]
}

/** One booking party for grouped export (attendees share seat/pickup) */
export interface ExportParty {
    orderId: number | null
    seat: string
    pickup: string
    eventDate: string | null
    isRsh: boolean
    isCancelled: boolean
    names: string[]
}

/** Flattened row for CSV (one attendee; group via orderId / partySize / attendeeIndex) */
export interface BookingExportRow {
    orderId: number | null
    partySize: number
    attendeeIndex: number
    name: string
    seat: string
    pickup: string
    eventDate: string | null
    isRsh: boolean
    isCancelled: boolean
}

export interface DashboardMetrics {
    totalOrders: number
    totalGuests: number
    totalAmount: number
    totalCommission: number
    totalFees: number
    totalProfit: number
    estimatedProfitAfterVAT: number
    rshAttendees: number
    rshAttendeesByDay: { date: string; count: number }[]
}

export interface EventMetrics {
    eventType: string
    totalGuests: number
    totalOrders: number
    totalAmount: number
    totalCommission: number
}

export interface DailyMetrics {
    date: string
    totalGuests: number
    totalOrders: number
    rshGuests: number
    nonRshGuests: number
}

export interface HourlyMetrics {
    label: string  // "14:00"
    totalOrders: number
    rshOrders: number
    nonRshOrders: number
    totalGuests: number
}

export interface TicketTypeSummary {
    sku: string
    eventType: string
    quantity: number
    totalAmount: number
    totalCommission: number
}

export interface EventDaySummary {
    eventDate: string
    ticketTypes: TicketTypeSummary[]
    totalOrders: number
    totalAmount: number
    totalCommission: number
}

export interface MonthlySummary {
    month: string // Format: YYYY-MM
    monthDisplay: string // Format: January 2024
    eventDays: EventDaySummary[]
    totalOrders: number
    totalAmount: number
    totalCommission: number
}
