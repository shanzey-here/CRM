import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as crypto from 'crypto'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function generateTestJwt(userId: string, tenantId: string, role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { tenant_id: tenantId, tenant_role: role }
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', process.env.SUPABASE_JWT_SECRET!)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

async function checkLeads() {
  const { data: users } = await supabaseAdmin.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').limit(1)
  const tenantId = users?.[0]?.tenant_id
  const userId = users?.[0]?.id

  console.log(`Tenant ID for admin@devtest.local: ${tenantId}`)
  
  const token = await generateTestJwt(userId, tenantId, 'tenant_admin')
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })

  const { data: leads, error } = await client.from('leads').select('*').eq('tenant_id', tenantId)
  
  if (error) {
    console.error('Error fetching leads:', error)
  } else {
    console.log(`Found ${leads.length} leads for this tenant via RLS client.`)
    console.log(JSON.stringify(leads, null, 2))
  }
}

checkLeads().catch(console.error)

checkLeads().catch(console.error)
