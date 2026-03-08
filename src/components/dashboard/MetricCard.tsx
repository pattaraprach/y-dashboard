'use client'

import { cn } from '@/lib/utils'

interface MetricCardProps {
    title: string
    value: string
    subtitle?: string
    icon: React.ReactNode
    variant?: 'default' | 'accent' | 'success' | 'warning'
    trend?: {
        value: number
        isPositive: boolean
    }
    breakdown?: { label: string; value: string }[]
}

export function MetricCard({
    title,
    value,
    subtitle,
    icon,
    variant = 'default',
    trend,
    breakdown,
}: MetricCardProps) {
    return (
        <div className={cn('metric-card', variant)}>
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-[var(--background-tertiary)]">
                    {icon}
                </div>
                {trend && (
                    <span
                        className={cn(
                            'text-sm font-medium px-2 py-1 rounded-md',
                            trend.isPositive
                                ? 'text-[var(--success)] bg-[var(--success-bg)]'
                                : 'text-[var(--error)] bg-[var(--error-bg)]'
                        )}
                    >
                        {trend.isPositive ? '+' : ''}{trend.value}%
                    </span>
                )}
            </div>
            <h3 className="text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                {title}
            </h3>
            <p className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
                {value}
            </p>
            {subtitle && (
                <p className="text-xs text-[var(--foreground-muted)] mt-2">
                    {subtitle}
                </p>
            )}
            {breakdown && breakdown.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
                    {breakdown.map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                            <span className="text-xs text-[var(--foreground-secondary)]">{item.label}</span>
                            <span className="text-xs font-semibold text-[var(--foreground)]">{item.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
