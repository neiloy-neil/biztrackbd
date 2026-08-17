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
        // Enforce they are actually an admin before letting them go to /admin/dashboard
        const { data: adminMember } = await supabase
          .from('platform_admins')
          .select('id')
          .eq('user_id', user.id)
          .single()
          
        if (adminMember) {
          url.pathname = url.hostname.startsWith('admin.') ? '/dashboard' : '/admin/dashboard'
        } else {
          url.pathname = '/app/dashboard'
        }
      } else if (isAppRoute) {
        url.pathname = url.hostname.startsWith('app.') ? '/dashboard' : '/app/dashboard'
      } else {
        url.pathname = '/app/dashboard'
      }
      return NextResponse.redirect(url)
    }

    // Check if they are trying to access an admin route while logged in
    if (isAdminRoute && !isLoginPath) {
      const { data: adminMember } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .single()
        
      if (!adminMember) {
        url.pathname = '/app/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Check onboarding state and business suspension (only for app routes, never admin routes)
    if (isAppRoute && !isAdminRoute) {
      const isSuspendedPath = pathname === '/app/suspended' || pathname === '/suspended'
      const isOnboardingPath = pathname === '/app/onboarding' || pathname === '/onboarding'

      const activeBusiness = request.cookies.get('active_business_id')

      if (!activeBusiness && !isOnboardingPath && !isSuspendedPath) {
        // No active business cookie — look up membership
        const { data: member } = await supabase
          .from('business_members')
          .select('business_id, businesses!inner(status)')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!member) {
          url.pathname = url.hostname.startsWith('app.') ? '/onboarding' : '/app/onboarding'
          return NextResponse.redirect(url)
        }

        const bizStatus = (member.businesses as any)?.status
        if (bizStatus !== 'active') {
          url.pathname = url.hostname.startsWith('app.') ? '/suspended' : '/app/suspended'
          return NextResponse.redirect(url)
        }

        supabaseResponse.cookies.set('active_business_id', member.business_id)
      } else if (activeBusiness && !isSuspendedPath) {
        // Cookie present — verify business is still active on every request
        const { data: biz } = await supabase
          .from('businesses')
          .select('status')
          .eq('id', activeBusiness.value)
          .single()

        const bizStatus = biz?.status
        if (bizStatus !== 'active') {
          // Clear the stale cookie and redirect
          const response = NextResponse.redirect(
            new URL(url.hostname.startsWith('app.') ? '/suspended' : '/app/suspended', request.url)
          )
          response.cookies.delete('active_business_id')
          return response
        }

        if (isOnboardingPath) {
          url.pathname = url.hostname.startsWith('app.') ? '/dashboard' : '/app/dashboard'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}
