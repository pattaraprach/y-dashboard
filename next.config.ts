import type { NextConfig } from 'next'

/**
 * Next 16.3 Instant Navigations:
 * - cacheComponents: enables Cache Components / use cache
 * - partialPrefetching: reusable App Shell prefetch (requires cacheComponents)
 * @see https://nextjs.org/blog/next-16-3
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
