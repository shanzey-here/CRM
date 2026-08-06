import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  console.log('=== job_crew_assignments.actual_start/actual_end ===')
  const jca = await sc.from('job_crew_assignments').select('id, actual_start, actual_end').limit(1)
  console.log('Query error:', jca.error ? JSON.stringify(jca.error) : '(none — columns exist)')

  console.log('\n=== leads.priority (default + enum check) ===')
  const leadsPriority = await sc.from('leads').select('id, priority').limit(3)
  console.log('Sample rows:', JSON.stringify(leadsPriority.data))
  console.log('Query error:', leadsPriority.error ? JSON.stringify(leadsPriority.error) : '(none)')

  console.log('\n=== contacts.preferred_contact_method / best_time_to_call ===')
  const contactsPrefs = await sc.from('contacts').select('id, preferred_contact_method, best_time_to_call').limit(3)
  console.log('Sample rows:', JSON.stringify(contactsPrefs.data))
  console.log('Query error:', contactsPrefs.error ? JSON.stringify(contactsPrefs.error) : '(none)')

  console.log('\n=== Enum constraint check: invalid contact_method value should be rejected ===')
  const { data: firstContact } = await sc.from('contacts').select('id').limit(1).single()
  if (firstContact) {
    const badUpdate = await sc.from('contacts').update({ preferred_contact_method: 'carrier_pigeon' as any }).eq('id', firstContact.id)
    console.log('Invalid enum value result (should error):', badUpdate.error ? JSON.stringify(badUpdate.error) : 'UNEXPECTED SUCCESS')
  }
}
main()
