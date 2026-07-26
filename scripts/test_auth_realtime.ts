import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseAnon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (error) return console.log('Login error:', error)
  
  const tenantId = data.user.user_metadata.tenant_id || 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
  console.log('Tenant:', tenantId)
  
  supabaseAnon.realtime.setAuth(data.session.access_token)
  
  supabaseAnon.channel('test-channel-123')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `tenant_id=eq.${tenantId}` }, payload => {
      console.log('!!! REALTIME EVENT RECEIVED:', payload)
      process.exit(0)
    })
    .subscribe(async (status) => {
      console.log('Subscription Status:', status)
      if (status === 'SUBSCRIBED') {
        console.log('Inserting lead as admin...')
        const { data: contact } = await supabaseAdmin.from('contacts').select('id').eq('tenant_id', tenantId).limit(1)
        await supabaseAdmin.from('leads').insert({ tenant_id: tenantId, contact_id: contact[0].id, stage: 'inquiry', estimated_volume: 500, source: 'website' })
      }
    })

  setTimeout(() => {
    console.log('Timeout - No event received')
    process.exit(1)
  }, 10000)
}
run()
