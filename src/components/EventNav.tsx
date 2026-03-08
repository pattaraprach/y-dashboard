'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function EventNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/cadcnx', label: 'Yipeng (CADCNX)', code: 'cadcnx' },
    { href: '/cadnye', label: 'New Year (CADNYE)', code: 'cadnye' },
  ]

  return (
    <nav className="mb-6 border-b border-[var(--border)]">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.code}
                href={item.href}
                className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:border-[var(--border)]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
        <form action="/auth/logout" method="POST">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
