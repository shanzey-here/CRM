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

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Public paths that don't require authentication
  // /api/public is the public, unauthenticated lead-capture endpoint.
  // /proposal is the public proposal page (non-guessable token-based access).
  // Both enforce their own tenant resolution in code instead of relying on session.
  const isPublicPath = path.startsWith('/login') || path.startsWith('/auth') || path === '/' || path.startsWith('/api/public') || path.startsWith('/proposal')

  // Redirect unauthenticated users trying to access protected paths
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Determine user's correct dashboard path based on role
  let correctDashboard = '/';
  if (user) {
    const appMetadata = user.app_metadata || {};
    if (appMetadata.is_super_admin) {
      correctDashboard = '/super-admin';
    } else if (appMetadata.tenant_role === 'tenant_admin') {
      correctDashboard = '/admin';
    } else if (appMetadata.tenant_role === 'dispatcher') {
      correctDashboard = '/office';
    } else if (appMetadata.tenant_role === 'crew') {
      correctDashboard = '/crew';
    }
  }

  // Redirect authenticated users away from login, home, or the old generic dashboard
  if (user && (path === '/login' || path === '/dashboard' || path === '/')) {
    // Prevent infinite loop if correctDashboard is '/'
    if (correctDashboard !== '/') {
      const url = request.nextUrl.clone();
      url.pathname = correctDashboard;
      return NextResponse.redirect(url);
    }
  }

  // Strictly enforce RBAC for the dashboard routes
  if (user) {
    const isSuperAdminRoute = path.startsWith('/super-admin');
    const isAdminRoute = path.startsWith('/admin');
    const isOfficeRoute = path.startsWith('/office');
    const isCrewRoute = path.startsWith('/crew');

    const appMetadata = user.app_metadata || {};
    
    // If they are on a route meant for a different role, redirect them to their correct dashboard
    if (
      (isSuperAdminRoute && !appMetadata.is_super_admin) ||
      (isAdminRoute && appMetadata.tenant_role !== 'tenant_admin') ||
      (isOfficeRoute && appMetadata.tenant_role !== 'dispatcher') ||
      (isCrewRoute && appMetadata.tenant_role !== 'crew')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = correctDashboard;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse
}
