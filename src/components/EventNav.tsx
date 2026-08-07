'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EventNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/cadcnx', label: 'Yipeng (CADCNX)', code: 'cadcnx' },
    { href: '/cadnye', label: 'New Year (CADNYE)', code: 'cadnye' },
  ]

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-0">
      <div className="flex gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.code}
              href={item.href}
              // Partial Prefetching (Next 16.3) reuses App Shells for these routes
              prefetch
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
      <form action="/auth/logout" method="POST">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </nav>
  )
}
