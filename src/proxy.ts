import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

export async function proxy(request: NextRequest) {
  const url = request.nextUrl
  let hostname = request.headers.get('host') || ''

  // Support local development (e.g. app.localhost:3000)
  const host = hostname.split(':')[0]

  let rewriteUrl: URL | null = null

  if (host === 'admin.biztrack.com' || host === 'admin.localhost') {
    rewriteUrl = new URL(`/admin${url.pathname === '/' ? '' : url.pathname}${url.search}`, request.url)
  } else if (host === 'app.biztrack.com' || host === 'app.localhost') {
    rewriteUrl = new URL(`/app${url.pathname === '/' ? '' : url.pathname}${url.search}`, request.url)
  }

  // Refresh Supabase session cookie and run admin check for /admin/* routes
  const response = await updateSession(request)

  if (rewriteUrl) {
    return NextResponse.rewrite(rewriteUrl, { headers: response.headers })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
