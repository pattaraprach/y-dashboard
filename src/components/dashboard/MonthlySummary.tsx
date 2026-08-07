'use client'
'use no memo'

import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  type ExpandedState,
  type PaginationState,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Badge } from '@/components/reui/badge'
import {
  DataGrid,
  DataGridContainer,
} from '@/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import {
  DataGridTable,
  DataGridTableRowExpand,
} from '@/components/reui/data-grid/data-grid-table'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { MonthlySummary as MonthlySummaryData } from '@/types/database'

interface MonthlySummaryProps {
  data: MonthlySummaryData[]
  isLoading: boolean
}

type RowKind = 'month' | 'event' | 'ticket'

interface SummaryTreeRow {
  id: string
  kind: RowKind
  label: string
  sku?: string
  orders: number
  amount: number
  commission: number
  children?: SummaryTreeRow[]
}

/** Fixed layout keeps <colgroup> widths so header + body stay aligned. */
const TABLE_LAYOUT = {
  dense: true,
  headerSticky: false,
  width: 'fixed' as const,
  columnsResizable: false,
  cellBorder: false,
  headerBorder: true,
}

const getCoreModel = getCoreRowModel()
const getExpandedModel = getExpandedRowModel()
const getPaginationModel = getPaginationRowModel()

function formatEventDate(dateStr: string) {
  if (!dateStr || dateStr === 'No Event Date') return dateStr || 'No event date'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function toTreeRows(months: MonthlySummaryData[]): SummaryTreeRow[] {
  return months.map((month) => ({
    id: `month:${month.month}`,
    kind: 'month' as const,
    label: month.monthDisplay,
    orders: month.totalOrders,
    amount: month.totalAmount,
    commission: month.totalCommission,
    children: month.eventDays.map((day) => ({
      id: `event:${month.month}:${day.eventDate}`,
      kind: 'event' as const,
      label: formatEventDate(day.eventDate),
      orders: day.totalOrders,
      amount: day.totalAmount,
      commission: day.totalCommission,
      children: day.ticketTypes.map((ticket, idx) => ({
        id: `ticket:${month.month}:${day.eventDate}:${ticket.sku}:${ticket.eventType}:${idx}`,
        kind: 'ticket' as const,
        label: ticket.eventType || 'Unknown',
        sku: ticket.sku || 'N/A',
        orders: ticket.quantity,
        amount: ticket.totalAmount,
        commission: ticket.totalCommission,
      })),
    })),
  }))
}

function kindBadge(kind: RowKind) {
  if (kind === 'month') {
    return <Badge variant="primary-light" size="sm">Month</Badge>
  }
  if (kind === 'event') {
    return <Badge variant="info-light" size="sm">Event day</Badge>
  }
  return <Badge variant="secondary" size="sm">Ticket</Badge>
}

export function MonthlySummary({ data, isLoading }: MonthlySummaryProps) {
  const treeData = useMemo(() => toTreeRows(data), [data])

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  })
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const columns = useMemo<ColumnDef<SummaryTreeRow>[]>(
    () => [
      {
        accessorKey: 'label',
        id: 'label',
        header: () => <span className="font-medium">Breakdown</span>,
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex min-w-0 items-center gap-1">
              <DataGridTableRowExpand row={row} className="-ms-1.5 -me-1 shrink-0" />
              <div className="min-w-0 flex-1">
                <div
                  className={
                    item.kind === 'month'
                      ? 'truncate font-semibold text-foreground'
                      : item.kind === 'event'
                        ? 'truncate font-medium text-foreground'
                        : 'truncate text-foreground'
                  }
                >
                  {item.label}
                </div>
                {item.kind === 'ticket' && item.sku ? (
                  <div className="truncate font-mono text-[0.7rem] text-muted-foreground">
                    {item.sku}
                  </div>
                ) : null}
              </div>
            </div>
          )
        },
        size: 320,
        minSize: 240,
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: 'w-[40%]',
          cellClassName: 'w-[40%]',
        },
      },
      {
        id: 'kind',
        accessorKey: 'kind',
        header: () => <span className="font-medium">Level</span>,
        cell: ({ row }) => kindBadge(row.original.kind),
        size: 110,
        enableSorting: false,
        meta: {
          headerClassName: 'w-[12%]',
          cellClassName: 'w-[12%]',
        },
      },
      {
        accessorKey: 'orders',
        header: () => (
          <span className="block w-full text-right font-medium">Orders / Qty</span>
        ),
        cell: ({ row }) => (
          <span className="block w-full text-right tabular-nums font-medium">
            {formatNumber(row.original.orders)}
          </span>
        ),
        size: 120,
        enableSorting: false,
        meta: {
          headerClassName: 'w-[14%] text-right',
          cellClassName: 'w-[14%] text-right',
        },
      },
      {
        accessorKey: 'amount',
        header: () => (
          <span className="block w-full text-right font-medium">Amount</span>
        ),
        cell: ({ row }) => (
          <span className="block w-full text-right tabular-nums font-medium">
            {formatCurrency(row.original.amount)}
          </span>
        ),
        size: 140,
        enableSorting: false,
        meta: {
          headerClassName: 'w-[17%] text-right',
          cellClassName: 'w-[17%] text-right',
        },
      },
      {
        accessorKey: 'commission',
        header: () => (
          <span className="block w-full text-right font-medium">Commission</span>
        ),
        cell: ({ row }) => (
          <span className="block w-full text-right tabular-nums font-medium text-success">
            {formatCurrency(row.original.commission)}
          </span>
        ),
        size: 140,
        enableSorting: false,
        meta: {
          headerClassName: 'w-[17%] text-right',
          cellClassName: 'w-[17%] text-right',
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: treeData,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    defaultColumn: {
      minSize: 80,
      size: 120,
    },
    state: {
      pagination,
      expanded,
    },
    paginateExpandedRows: false,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreModel,
    getExpandedRowModel: getExpandedModel,
    getPaginationRowModel: getPaginationModel,
    autoResetPageIndex: false,
  })

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-4 py-4">
        <CardTitle className="text-base">Monthly summary</CardTitle>
        <CardDescription>
          Expand months → event days → ticket types (tree data grid)
        </CardDescription>
      </CardHeader>

      <div className="p-4 pt-3">
        {isLoading ? (
          <DataGrid
            table={table}
            recordCount={0}
            isLoading
            loadingMode="skeleton"
            emptyMessage="Loading monthly summary…"
            tableLayout={TABLE_LAYOUT}
          >
            <DataGridContainer>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        ) : treeData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No data available
          </p>
        ) : (
          <DataGrid
            table={table}
            recordCount={treeData.length}
            emptyMessage="No data available"
            tableLayout={TABLE_LAYOUT}
          >
            <div className="w-full space-y-2.5">
              <DataGridContainer className="w-full overflow-x-auto">
                <DataGridTable />
              </DataGridContainer>
              <DataGridPagination sizes={[4, 8, 16]} />
            </div>
          </DataGrid>
        )}
      </div>
    </Card>
  )
}
