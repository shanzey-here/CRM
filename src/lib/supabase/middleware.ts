import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getCorrectDashboardPath } from './dashboard-path'

export async function updateSession(request: NextRequest) {
  // Server Components (layouts especially) have no built-in way to read the
  // current pathname — Next.js's own docs confirm layouts don't re-render on
  // navigation, so there's no equivalent of the client-only usePathname()
  // hook. The documented workaround is to forward it as a request header set
  // here in proxy, since this is the one place per-request that already has
  // `request.nextUrl.pathname`. (A prior version of this file read a
  // `x-invoke-path` header that Next.js never actually sets anywhere — that
  // silently broke the /office/settings/billing exemption for
  // cancelled/suspended/past_due tenants into an infinite redirect loop,
  // caught only by an end-to-end test with a real backdated test tenant.)
  // Rebuilt fresh (not hoisted) each time it's used below — request.cookies.set()
  // inside setAll() mutates request.headers' live Cookie entry when Supabase
  // rotates the session token mid-request, and a `new Headers(request.headers)`
  // snapshot taken before that mutation would silently forward the stale,
  // pre-refresh cookie to downstream Server Components instead of the rotated
  // one. Reading request.headers fresh at each NextResponse.next() call avoids
  // that.
  function buildRequestHeaders() {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', request.nextUrl.pathname)
    return requestHeaders
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: buildRequestHeaders() },
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
            request: { headers: buildRequestHeaders() },
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
  // /embed is the public, embeddable lead-capture widget (non-guessable
  // per-brand widget-key access, resolved in-code exactly like /proposal's
  // token) — found missing here during Part 3 verification: without this,
  // an unauthenticated visitor on an external website hitting the widget
  // was redirected straight to /login, making the entire feature
  // unreachable. Pre-existing gap, not introduced by this branch.
  // /api/cron routes authenticate themselves via a Bearer CRON_SECRET header —
  // an external scheduler never carries a Supabase session cookie, so this path
  // must be exempted here or every cron hit gets redirected to /login before
  // the route's own auth check ever runs.
  // All of the above enforce their own tenant/secret resolution in code instead of relying on session.
  const isPublicPath = path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/auth') || path === '/' || path.startsWith('/api/public') || path.startsWith('/api/webhooks') || path.startsWith('/proposal') || path.startsWith('/embed') || path.startsWith('/api/cron') || path.startsWith('/crew/test') || path === '/crew-sw.js' || path === '/manifest.json' || path.startsWith('/_next/') || path === '/sw.js'

  // Redirect unauthenticated users trying to access protected paths
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Determine user's correct dashboard path based on role
  const correctDashboard = user ? getCorrectDashboardPath(user.app_metadata) : '/';

  // Redirect authenticated users away from login, home, or the old generic dashboard
  if (user && (path === '/login' || path === '/dashboard' || path === '/' || path === '/admin')) {
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
      (isOfficeRoute && appMetadata.tenant_role !== 'dispatcher' && appMetadata.tenant_role !== 'tenant_admin') ||
      (isCrewRoute && appMetadata.tenant_role !== 'crew')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = correctDashboard;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse
}
