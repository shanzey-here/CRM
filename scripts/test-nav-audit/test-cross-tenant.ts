import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: signIn } = await sc.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  console.log('Signed in as tenant:', signIn?.user?.app_metadata?.tenant_id)

  const otherTenantJobId = '535154ca-0b81-483a-9f86-998a41444018'
  const myTenantId = signIn?.user?.app_metadata?.tenant_id

  console.log('\n=== Attempt to READ another tenant\'s job (RLS should block) ===')
  const { data: readResult, error: readError } = await sc.from('jobs').select('id, completion_summary').eq('id', otherTenantJobId).maybeSingle()
  console.log('Read result:', JSON.stringify(readResult), readError ? JSON.stringify(readError) : '(no error)')

  console.log('\n=== Attempt to WRITE completion_summary to another tenant\'s job, scoped by MY tenant_id (app-level guard) ===')
  const { data: writeResult, error: writeError, count } = await sc
    .from('jobs')
    .update({ completion_summary: { hacked: true } } as any)
    .eq('id', otherTenantJobId)
    .eq('tenant_id', myTenantId) // mimics updateJob()'s explicit tenant scoping
    .select()
  console.log('Write result (should be empty array, zero rows affected):', JSON.stringify(writeResult), writeError ? JSON.stringify(writeError) : '(no error)')

  console.log('\n=== Confirm via service role that the other tenant\'s job was NOT modified ===')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: realState } = await admin.from('jobs').select('id, completion_summary').eq('id', otherTenantJobId).single()
  console.log('Other tenant job real state:', JSON.stringify(realState))
}
main()
