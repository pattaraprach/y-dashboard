'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  sortFn_datetime,
  useTable,
} from '@tanstack/react-table'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Badge } from '@/components/reui/badge'
import { formatCurrency, formatCustomerName, formatDate } from '@/lib/utils'
import type { Booking } from '@/types/database'

interface OrdersTableProps {
  bookings: Booking[]
  onRowClick: (booking: Booking) => void
  isLoading?: boolean
}

/** Stable layout — never allocate a new object per render (invalidates DataGrid context). */
const TABLE_LAYOUT = {
  dense: true,
  headerSticky: false,
  width: 'auto' as const,
  columnsResizable: false,
}

function OrdersTableInner({ bookings, onRowClick, isLoading }: OrdersTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })
  // Latest Woo orders first (woo_id). Prefer order_created_at column when sorting by date.
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'woo_id', desc: true },
  ])

  // Filter changes should jump back to page 1 without sorting work on a dead page.
  // Defer so setState is not synchronous in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) =>
        prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
      )
    }, 0)
    return () => clearTimeout(timer)
  }, [bookings])

  const columns = useMemo<ColumnDef<DataGridFeatures, Booking>[]>(
    () => [
      {
        accessorKey: 'woo_id',
        header: 'ID',
        // String name resolves against dataGridFeatures.sortFns (tree-shaken registry).
        sortFn: 'basic',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            #{row.original.woo_id ?? '—'}
          </span>
        ),
        size: 90,
      },
      {
        id: 'name',
        header: 'Name',
        accessorFn: (row) => formatCustomerName(row),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>() || '—'}</span>
        ),
        size: 150,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (
          <span className="block max-w-[180px] truncate text-muted-foreground">
            {getValue<string>() || '—'}
          </span>
        ),
        size: 180,
      },
      {
        accessorKey: 'event_date',
        header: 'Event Date',
        cell: ({ getValue }) => formatDate(getValue<string | null>()),
        size: 120,
      },
      {
        accessorKey: 'zone_code',
        header: 'Zone',
        cell: ({ row }) =>
          row.original.zone_code ? (
            <Badge variant="primary-light" size="sm">
              {row.original.zone_code}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        size: 90,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(Number(getValue()))}
          </span>
        ),
        size: 110,
        meta: {
          headerClassName: 'text-right',
          cellClassName: 'text-right',
        },
      },
      {
        accessorKey: 'seat',
        header: 'Seat',
        cell: ({ getValue }) => {
          const seat = getValue<string | null>()
          return seat ? (
            <Badge variant="success-light" size="sm">
              {seat}
            </Badge>
          ) : (
            <span className="text-muted-foreground">Not assigned</span>
          )
        },
        size: 110,
      },
      {
        accessorKey: 'pickup_loc',
        header: 'Pickup',
        cell: ({ getValue }) => {
          const pickup = getValue<string | null>()
          return (
            <span className="block max-w-[140px] truncate">
              {pickup || <span className="text-muted-foreground">Not set</span>}
            </span>
          )
        },
        size: 140,
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row,
        enableSorting: false,
        cell: ({ row }) => {
          const b = row.original
          if (!b.is_cancelled) {
            return (
              <Badge variant="success-light" size="sm">
                Active
              </Badge>
            )
          }
          if (b.refund_status === 'partial') {
            return (
              <Badge variant="warning-light" size="sm">
                Partial refund
              </Badge>
            )
          }
          if (b.refund_status === 'full') {
            return (
              <Badge variant="destructive-light" size="sm">
                Refunded
              </Badge>
            )
          }
          return (
            <Badge variant="destructive-light" size="sm">
              Cancelled
            </Badge>
          )
        },
        size: 120,
      },
      {
        id: 'order_created_at',
        header: 'Ordered',
        accessorFn: (row) => row.order_created_at || row.created_at,
        // Direct fn import: not registered on dataGridFeatures, so no full sortFns registry cost.
        sortFn: sortFn_datetime,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.order_created_at || row.original.created_at)}
          </span>
        ),
        size: 120,
      },
    ],
    []
  )

  const table = useTable({
    features: dataGridFeatures,
    data: bookings,
    columns,
    // Stable row identity keeps selection/pinning/memoization correct under v9's new wrappers.
    getRowId: (row) => String(row.id),
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    // Avoid auto-reset thrash when parent rebuilds the filtered array identity.
    autoResetPageIndex: false,
  })

  return (
    <DataGrid
      table={table}
      recordCount={bookings.length}
      isLoading={isLoading}
      loadingMode="skeleton"
      emptyMessage="No orders found"
      onRowClick={onRowClick}
      tableLayout={TABLE_LAYOUT}
    >
      <div className="w-full space-y-2.5">
        {/*
          No DataGridScrollArea + headerSticky: that path attaches ResizeObservers
          and custom scrollbar metrics and was a major runtime cost vs the old table.
        */}
        <DataGridContainer className="overflow-x-auto">
          <DataGridTable />
        </DataGridContainer>
        <DataGridPagination sizes={[10, 25, 50, 100]} />
      </div>
    </DataGrid>
  )
}

export const OrdersTable = memo(OrdersTableInner)
