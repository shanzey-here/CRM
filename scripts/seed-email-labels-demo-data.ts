import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  const { data: labels } = await admin.from('email_labels').select('id, name').eq('tenant_id', TENANT_A)
  const byName = new Map((labels ?? []).map((l) => [l.name, l.id]))

  const { data: threads } = await admin.from('email_threads').select('id, subject').eq('tenant_id', TENANT_A).order('last_message_at', { ascending: false }).limit(6)
  console.log('Threads to label:', threads?.map((t) => t.subject))

  // Clear any leftover assignments/suggestions from prior verification runs.
  const threadIds = (threads ?? []).map((t) => t.id)
  await admin.from('email_label_assignments').delete().in('thread_id', threadIds)
  await admin.from('email_label_suggestions').delete().in('thread_id', threadIds)

  const assignments = [
    { thread: threads?.[0], labelNames: ['New Lead', 'Complaint / Urgent'] },
    { thread: threads?.[1], labelNames: ['Quote Requested'] },
    { thread: threads?.[2], labelNames: ['Paid', 'Job Completed'] },
  ]

  for (const a of assignments) {
    if (!a.thread) continue
    for (const name of a.labelNames) {
      const labelId = byName.get(name)
      if (!labelId) continue
      const { error } = await admin.from('email_label_assignments').insert({ thread_id: a.thread.id, label_id: labelId, tenant_id: TENANT_A, applied_by: null })
      console.log(`Assigned "${name}" to "${a.thread.subject}":`, error ? error.message : 'OK')
    }
  }

  // A pending suggestion for the review-queue screenshot/approve test.
  if (threads?.[3]) {
    const labelId = byName.get('Awaiting Reply')
    if (labelId) {
      const { error } = await admin.from('email_label_suggestions').insert({ thread_id: threads[3].id, label_id: labelId, tenant_id: TENANT_A, model: 'demo-seed' })
      console.log(`Created pending suggestion "Awaiting Reply" on "${threads[3].subject}":`, error ? error.message : 'OK')
    }
  }

  console.log('\nDemo data ready.')
}
main().catch((e) => { console.error(e); process.exit(1) })
