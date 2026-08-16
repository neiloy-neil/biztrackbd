import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl
  let hostname = request.headers.get('host') || ''

  // Support local development (e.g. app.localhost:3000)
  // Remove port if exists for cleaner matching
  const host = hostname.split(':')[0]

  let rewriteUrl: URL | null = null

  if (host === 'admin.biztrack.com' || host === 'admin.localhost') {
    // Rewrite to /admin/...
    rewriteUrl = new URL(`/admin${url.pathname === '/' ? '' : url.pathname}${url.search}`, request.url)
  } else if (host === 'app.biztrack.com' || host === 'app.localhost') {
    // Rewrite to /app/...
    rewriteUrl = new URL(`/app${url.pathname === '/' ? '' : url.pathname}${url.search}`, request.url)
  }

  // Pass the (potentially rewritten) request to Supabase auth middleware
  const response = await updateSession(request)

  if (rewriteUrl) {
    return NextResponse.rewrite(rewriteUrl, { headers: response.headers })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
