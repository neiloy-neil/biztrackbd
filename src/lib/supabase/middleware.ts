import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const url = request.nextUrl.clone()

  const isLoginPath = pathname === '/app/login' || pathname === '/login' || pathname === '/admin/login'
  const isPublicPath = pathname === '/' || pathname === '/pricing' || pathname === '/about' || pathname === '/contact'
  
  const isAdminRoute = url.hostname.startsWith('admin.') || pathname.startsWith('/admin')
  const isAppRoute = url.hostname.startsWith('app.') || pathname.startsWith('/app')

  // Prevent users from getting stuck on a 404 if they manually type /dashboard on localhost
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') && !host.includes('app.localhost') && !host.includes('admin.localhost')
  if (isLocalhost && pathname === '/dashboard') {
    url.pathname = '/app/dashboard'
    return NextResponse.redirect(url)
  }
  
  if (isLocalhost && pathname === '/onboarding') {
    url.pathname = '/app/onboarding'
    return NextResponse.redirect(url)
  }

  if (!user && !isLoginPath && !pathname.startsWith('/auth') && !isPublicPath) {
    if (isAdminRoute) {
      url.pathname = url.hostname.startsWith('admin.') ? '/login' : '/admin/login'
    } else if (isAppRoute) {
      url.pathname = url.hostname.startsWith('app.') ? '/login' : '/app/login'
    } else {
      url.pathname = '/app/login' // Fallback
    }
    return NextResponse.redirect(url)
  }

  if (user) {
    if (isLoginPath || (isPublicPath && pathname === '/')) {
      if (isAdminRoute) {
        url.pathname = url.hostname.startsWith('admin.') ? '/dashboard' : '/admin/dashboard'
      } else if (isAppRoute) {
        url.pathname = url.hostname.startsWith('app.') ? '/dashboard' : '/app/dashboard'
      } else {
        url.pathname = '/app/dashboard'
      }
      return NextResponse.redirect(url)
    }

    // Check if onboarding is needed (only for app routes, never admin routes)
    if (isAppRoute && !isAdminRoute) {
      const activeBusiness = request.cookies.get('active_business_id')
      if (!activeBusiness && pathname !== '/app/onboarding' && pathname !== '/onboarding') {
        const { data: member } = await supabase
          .from('business_members')
          .select('business_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()
        
        if (!member) {
          url.pathname = url.hostname.startsWith('app.') ? '/onboarding' : '/app/onboarding'
          return NextResponse.redirect(url)
        } else {
          supabaseResponse.cookies.set('active_business_id', member.business_id)
        }
      } else if (activeBusiness && (pathname === '/app/onboarding' || pathname === '/onboarding')) {
        url.pathname = url.hostname.startsWith('app.') ? '/dashboard' : '/app/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
