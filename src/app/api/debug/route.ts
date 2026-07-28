import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    // Decode JWT payload without verification just to inspect it
    const parts = session.access_token.split('.')
    let jwtPayload = null
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8')
      try {
        jwtPayload = JSON.parse(payloadStr)
      } catch(e) {}
    }

    // Check public.users using Service Role to ensure the row actually exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const adminSupabase = createAdminClient(supabaseUrl, serviceKey)

    const { data: publicUser, error: publicUserError } = await adminSupabase
      .from('users')
      .select('id, role, tenant_id, email')
      .eq('id', session.user.id)
      .single()

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')

    return NextResponse.json({
      1: "JWT Payload Data (Does it have tenant_role and tenant_id?)",
      jwt_app_metadata: jwtPayload?.app_metadata,
      
      2: "Public.Users Table Data (Does the DB have your role/tenant?)",
      public_user_row: publicUser || "NOT FOUND",
      public_user_error: publicUserError?.message,

      3: "Session App Metadata (From Auth Database)",
      session_app_metadata: session.user.app_metadata,

      4: "RLS Test",
      leads_found: leads?.length,
      leads_error: leadsError?.message
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
