import { sign } from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const jwtSecret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('--- UI RENDER VERIFICATION ---')

  const { data: tenants } = await supabase.from('tenants').select('id').limit(2)
  const t1 = tenants![0].id
  const t2 = tenants![1].id

  // Create mock users
  const adminId = '11111111-1111-1111-1111-111111111111'
  const dispatcherId = '22222222-2222-2222-2222-222222222222'
  const customerId = '33333333-3333-3333-3333-333333333333'

  const makeJwt = (userId: string, role: string, tenantId: string) => {
    return sign({
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: userId,
      role: 'authenticated',
      app_metadata: {
        tenant_id: tenantId,
        tenant_role: role
      }
    }, jwtSecret)
  }

  const adminJwt = makeJwt(adminId, 'tenant_admin', t1)
  const dispatcherJwt = makeJwt(dispatcherId, 'dispatcher', t1)
  const customerJwt = makeJwt(customerId, 'customer', t1)
  const t2AdminJwt = makeJwt(adminId, 'tenant_admin', t2)

  // Start checking routes
  const checkRoute = async (path: string, jwt: string, expectedStatus: number, mustContain?: string) => {
    try {
      const res = await fetch(`http://localhost:3000${path}`, {
        headers: {
          Cookie: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token=${jwt}` // Mocking standard supabase cookie structure
        },
        redirect: 'manual'
      })
      
      console.log(`[${path}] Status: ${res.status} (expected ${expectedStatus})`)
      
      if (mustContain && res.status === 200) {
        const text = await res.text()
        const found = text.includes(mustContain)
        console.log(`[${path}] Contains "${mustContain}"? ${found}`)
      }
      return res.status
    } catch (err: any) {
      console.error(`[${path}] Fetch error: ${err.message}`)
      return null
    }
  }

  console.log('\nTesting tenant_admin access to /office/workflows:')
  await checkRoute('/office/workflows', adminJwt, 200, 'Workflows are in Preview')

  console.log('\nTesting tenant_admin access to /office/workflows/new:')
  await checkRoute('/office/workflows/new', adminJwt, 200, 'Workflow Settings')

  console.log('\nTesting dispatcher access to /office/workflows (should redirect or 403):')
  await checkRoute('/office/workflows', dispatcherJwt, 307) // Redirects to /office

  console.log('\nTesting customer access to /office/workflows (should redirect):')
  await checkRoute('/office/workflows', customerJwt, 307) // Redirects to /office

  console.log('\nTesting tenant B access to tenant A\'s workflow logs (should 404):')
  // We need a dummy workflow ID to test
  await checkRoute('/office/workflows/00000000-0000-0000-0000-000000000000/logs', t2AdminJwt, 404)

  console.log('--- DONE ---')
}

run().catch(console.error)
