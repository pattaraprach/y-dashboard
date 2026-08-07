import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth gate for navigations / RSC. Uses getClaims() so JWT is verified via
 * JWKS (usually local / cached) instead of getUser()'s Auth round-trip every request.
 * @see https://supabase.com/docs/reference/javascript/auth-getclaims
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Prefer claims over getUser(): asymmetric keys verify locally; JWKS is cached.
  const { data: claimsData } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(claimsData?.claims?.sub)

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/auth/login'
  const isAuthApi =
    pathname.startsWith('/auth/logout') || pathname.startsWith('/auth/callback')

  if (!isAuthenticated && !isLoginPage && !isAuthApi) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (isAuthenticated && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/cadcnx'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Only gate app navigations — skip static assets, images, and Next internals.
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon / common public assets
     * - files with extensions (images, fonts, maps, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)',
  ],
}
