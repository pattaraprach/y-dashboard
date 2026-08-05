export type Database = {
    public: {
        Tables: {
            cad_yip_bookings: {
                Row: {
                    id: number
                    created_at: string | null
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
                }
                Insert: Omit<Database['public']['Tables']['cad_yip_bookings']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['cad_yip_bookings']['Row']>
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
export type Attendee = Database['public']['Tables']['cad_yip_attendees']['Row']
export type Link = Database['public']['Tables']['cad_yip_links']['Row']
export type Price = Database['public']['Tables']['cad_yip_prices']['Row']

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
