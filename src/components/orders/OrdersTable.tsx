'use client'

import { memo, useMemo } from 'react'
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Badge } from '@/components/reui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getChildCount } from '@/lib/child-count'
import { formatCurrency, formatCustomerName, formatDate } from '@/lib/utils'
import type { Booking } from '@/types/database'

interface OrdersTableProps {
  bookings: Booking[]
  totalCount: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
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

const CELL_SKELETON = <Skeleton className="h-5 w-full max-w-24" />

function OrdersTableInner({
  bookings,
  totalCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  onRowClick,
  isLoading,
}: OrdersTableProps) {

  const columns = useMemo<ColumnDef<DataGridFeatures, Booking>[]>(
    () => [
      {
        accessorKey: 'woo_id',
        header: ({ column }) => <DataGridColumnHeader title="ID" column={column} />,
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
        header: ({ column }) => <DataGridColumnHeader title="Name" column={column} />,
        accessorFn: (row) => formatCustomerName(row),
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>() || '—'}</span>
        ),
        size: 150,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => <DataGridColumnHeader title="Email" column={column} />,
        cell: ({ getValue }) => (
          <span className="block max-w-[180px] truncate text-muted-foreground">
            {getValue<string>() || '—'}
          </span>
        ),
        size: 180,
      },
      {
        accessorKey: 'event_date',
        header: ({ column }) => <DataGridColumnHeader title="Event Date" column={column} />,
        cell: ({ getValue }) => formatDate(getValue<string | null>()),
        size: 120,
      },
      {
        accessorKey: 'zone_code',
        header: ({ column }) => <DataGridColumnHeader title="Zone" column={column} />,
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
        header: ({ column }) => <DataGridColumnHeader title="Amount" column={column} />,
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(Number(getValue()))}
          </span>
        ),
        size: 110,
        meta: {
          headerClassName: 'text-right',
          cellClassName: 'text-right',
          skeleton: CELL_SKELETON,
        },
      },
      {
        accessorKey: 'seat',
        header: ({ column }) => <DataGridColumnHeader title="Seat" column={column} />,
        cell: ({ row, getValue }) => {
          const seat = getValue<string | null>()
          const children = row.original.is_rsh_transfer
            ? getChildCount(row.original)
            : 0
          // If seat already has +NC / +NCHD, don't duplicate a second badge.
          const showChildBadge =
            children > 0 && !/\+\s*\d+\s*C(?:HD)?\b/i.test(seat || '')
          return (
            <span className="inline-flex flex-wrap items-center gap-1">
              {seat ? (
                <Badge variant="success-light" size="sm">
                  {seat}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Not assigned</span>
              )}
              {showChildBadge ? (
                <Badge variant="warning-light" size="sm">
                  +{children}C
                </Badge>
              ) : null}
            </span>
          )
        },
        size: 130,
      },
      {
        accessorKey: 'pickup_loc',
        header: ({ column }) => <DataGridColumnHeader title="Pickup" column={column} />,
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
        accessorKey: 'is_cancelled',
        header: ({ column }) => <DataGridColumnHeader title="Status" column={column} />,
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
        header: ({ column }) => <DataGridColumnHeader title="Ordered" column={column} />,
        accessorFn: (row) => row.order_created_at || row.created_at,
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
    defaultColumn: { meta: { skeleton: CELL_SKELETON } },
    // Stable row identity keeps selection/pinning/memoization correct under v9's new wrappers.
    getRowId: (row) => String(row.id),
    state: { pagination, sorting },
    onPaginationChange,
    onSortingChange,
    manualPagination: true,
    manualSorting: true,
    rowCount: totalCount,
    enableSorting: true,
    autoResetPageIndex: false,
  })

  const rowsKey = useMemo(() => JSON.stringify(bookings), [bookings])

  return (
    <DataGrid
      key={rowsKey}
      table={table}
      recordCount={totalCount}
      isLoading={Boolean(isLoading && bookings.length === 0)}
      loadingMode="skeleton"
      emptyMessage="No orders found"
      onRowClick={onRowClick}
      tableLayout={TABLE_LAYOUT}
    >
      <div className="w-full space-y-2.5" aria-busy={isLoading}>
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
