import { getChildCount } from '@/lib/child-count'
import type {
  BookingOpsPatch,
  BookingWithAttendees,
  DashboardMetrics,
} from '@/types/database'

export function applyBookingOpsPatch(
  bookings: BookingWithAttendees[],
  metrics: DashboardMetrics | null,
  patch: BookingOpsPatch
) {
  const current = bookings.find((booking) => booking.id === patch.id)
  if (!current) return { bookings, metrics }

  const updated = { ...current, ...patch }
  const childDelta =
    current.is_rsh_transfer && !current.is_cancelled
      ? getChildCount(updated) - getChildCount(current)
      : 0

  return {
    bookings: bookings.map((booking) =>
      booking.id === patch.id ? updated : booking
    ),
    metrics:
      metrics && childDelta
        ? {
            ...metrics,
            rshAttendees: metrics.rshAttendees + childDelta,
            rshAttendeesByDay: metrics.rshAttendeesByDay.map((day) =>
              day.date === (current.event_date || 'Unknown')
                ? { ...day, count: day.count + childDelta }
                : day
            ),
          }
        : metrics,
  }
}
