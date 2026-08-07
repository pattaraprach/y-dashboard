'use client'

import type { ReactNode } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: ReactNode
  variant?: 'default' | 'accent' | 'success' | 'warning'
  /** Day / segment chips shown inline so card height matches siblings */
  breakdown?: { label: string; value: string }[]
}

const variantAccent: Record<NonNullable<MetricCardProps['variant']>, string> = {
  default: 'text-foreground',
  accent: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning-foreground',
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  breakdown,
}: MetricCardProps) {
  const hasBreakdown = Boolean(breakdown && breakdown.length > 0)

  return (
    <Card size="sm" className="h-full">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <CardDescription className="leading-snug">{title}</CardDescription>
          <CardTitle
            className={cn(
              'text-2xl font-semibold tracking-tight',
              variantAccent[variant]
            )}
          >
            {value}
          </CardTitle>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {hasBreakdown ? (
          <div className="flex shrink-0 items-stretch gap-2 self-center">
            {breakdown!.map((item) => (
              <div
                key={item.label}
                className="flex min-w-[4.5rem] flex-col items-center justify-center rounded-lg border bg-muted/40 px-2.5 py-2 text-center"
              >
                <span className="text-base font-semibold tabular-nums leading-none">
                  {item.value}
                </span>
                <span className="mt-1.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ) : icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
      </CardHeader>
    </Card>
  )
}
