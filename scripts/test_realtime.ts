import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function testRealtime() {
  const tenantId = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  console.log('Setting up Realtime subscription using Admin Client...')
  
  const channel = supabaseAdmin
    .channel('test-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `tenant_id=eq.${tenantId}`
      },
      (payload) => {
        console.log('REALTIME EVENT RECEIVED!', payload)
        process.exit(0)
      }
    )
    .subscribe(async (status) => {
      console.log('Subscription status:', status)
      
      if (status === 'SUBSCRIBED') {
        console.log('Inserting lead...')
        
        const { data: contact } = await supabaseAdmin.from('contacts').insert({
          tenant_id: tenantId,
          first_name: 'Realtime',
          last_name: 'Test',
          email: 'realtime@test.com'
        }).select().single()

        const { error } = await supabaseAdmin.from('leads').insert({
          tenant_id: tenantId,
          contact_id: contact!.id,
          stage: 'inquiry',
          is_archived: false,
        })
        if (error) console.error('Insert error', error)
      }
    })
    
    setTimeout(() => {
        console.log('Timeout - No event received!')
        process.exit(1)
    }, 5000)
}

testRealtime()
