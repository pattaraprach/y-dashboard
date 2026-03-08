import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  const url = request.nextUrl.clone()
  url.pathname = '/auth/login'
  return NextResponse.redirect(url, { status: 302 })
}
