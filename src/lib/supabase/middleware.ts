import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  if (!user && pathname !== '/login' && !pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Check if onboarding is needed (only if they don't have an active business cookie)
    const activeBusiness = request.cookies.get('active_business_id')
    if (!activeBusiness && pathname !== '/onboarding') {
      // Check DB to see if they actually have a business
      const { data: member } = await supabase
        .from('business_members')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      
      if (!member) {
        // No business found, redirect to onboarding
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      } else {
        // Has a business, set cookie and let them proceed
        supabaseResponse.cookies.set('active_business_id', member.business_id)
      }
    } else if (activeBusiness && pathname === '/onboarding') {
      // Already has a business, shouldn't be on onboarding
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
