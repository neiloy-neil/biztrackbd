import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost')

  // Define domains
  const isAdminDomain = host.startsWith('admin.') || (isLocalhost && request.nextUrl.pathname.startsWith('/admin'))
  const isAppDomain = host.startsWith('app.') || (isLocalhost && request.nextUrl.pathname.startsWith('/app'))

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ==========================================
  // ADMIN PLANE AUTHENTICATION
  // ==========================================
  if (isAdminDomain) {
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
        cookieOptions: {
          name: 'sb-admin-auth-token'
        }
      }
    )

    const { data: { user } } = await adminSupabase.auth.getUser()
    
    // Protect /admin routes (except login)
    if (request.nextUrl.pathname !== '/admin/login' && request.nextUrl.pathname.startsWith('/admin')) {
      if (!user) {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }
    }
    
    // Redirect /admin/login to dashboard if already logged in
    if (request.nextUrl.pathname === '/admin/login' && user) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    
    return response
  }

  // ==========================================
  // BUSINESS PLANE AUTHENTICATION
  // ==========================================
  if (isAppDomain) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
        // Uses default cookie prefix: sb-[ref]-auth-token
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const isLoginPage = request.nextUrl.pathname.endsWith('/login') || request.nextUrl.pathname === '/'
    
    if (!user && !isLoginPage) {
      const loginUrl = isLocalhost ? '/app/login' : '/login'
      return NextResponse.redirect(new URL(loginUrl, request.url))
    }

    if (user && isLoginPage) {
      const dashboardUrl = isLocalhost ? '/app/dashboard' : '/dashboard'
      return NextResponse.redirect(new URL(dashboardUrl, request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
