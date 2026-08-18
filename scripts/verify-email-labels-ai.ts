/**
 * Verifies the AI classifier extension + trust-gate routing + FIX #3 for
 * the Email Labels feature, against the real linked Supabase project and
 * a real Gemini API call (no mocking) on real synced email threads.
 *
 * Usage: npx tsx scripts/verify-email-labels-ai.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

function log(msg: string) {
  console.log(`\n=== ${msg} ===`)
}

async function main() {
  const { getLlmAdapter } = await import('../src/modules/ai-email/provider')
  const { resolveLabelAutoApply } = await import('../src/modules/ai-email/server/gate')
  const { maybeSuggestLabels } = await import('../src/modules/ai-email/server/label-suggest')
  const { getDefaultLabels, getLabels, createLabel, getLabelAssignmentsForThread } = await import(
    '../src/modules/email-labels/server/repository'
  )

  // Preserve real state, restore at the end — this is a real, shared dev tenant.
  const { data: originalSettings } = await admin
    .from('tenant_settings')
    .select('ai_quoting_mode')
    .eq('tenant_id', TENANT_A)
    .single()
  const originalMode = originalSettings?.ai_quoting_mode
  console.log(`Tenant A's real current ai_quoting_mode: ${originalMode}`)

  // Clean up any leftover suggestions/assignments from a previous run.
  await admin.from('email_label_suggestions').delete().eq('tenant_id', TENANT_A)

  const { data: thread } = await admin
    .from('email_threads')
    .select('id, subject')
    .eq('tenant_id', TENANT_A)
    .eq('subject', 'Testing mail 1')
    .single()
  if (!thread) throw new Error('Fixture thread not found')
  console.log(`Using real thread: "${thread.subject}" (${thread.id})`)

  // Clear any prior assignments on this thread from earlier verification runs.
  await admin.from('email_label_assignments').delete().eq('thread_id', thread.id)

  const { data: messages } = await admin
    .from('email_messages')
    .select('direction, from_address, body_text, occurred_at')
    .eq('thread_id', thread.id)
    .order('occurred_at', { ascending: true })
  const threadText = (messages ?? [])
    .map((m) => `[${m.direction === 'inbound' ? 'Customer' : 'Business'} — ${m.from_address}]\n${m.body_text ?? '(no text)'}`)
    .join('\n\n---\n\n')
  console.log(`Real thread has ${messages?.length ?? 0} messages, ${threadText.length} chars of text`)

  const { data: defaultLabels } = await getDefaultLabels(admin, TENANT_A)
  console.log(`Tenant A's real default labels (closed set passed to Gemini): ${(defaultLabels ?? []).map((l) => l.name).join(', ')}`)

  const adapter = getLlmAdapter()

  // ── Item 2 + 11: real classify() call, additive fields ──────────────────
  log('1. Real classify() call (item 11: shows the extended ClassifyResult shape)')
  const systemPrompt = 'You are the AI assistant for a UK removals company.'
  const classifyResult = await adapter.classify({ systemPrompt, threadText, defaultLabels: defaultLabels ?? [] })
  console.log('Real ClassifyResult:', JSON.stringify(classifyResult, null, 2))

  // ── Item 2: low trust (assist) — suggestion, not auto-applied ────────────
  log('2. LOW TRUST (assist): label suggestion lands in review queue, not auto-applied')
  await admin.from('tenant_settings').update({ ai_quoting_mode: 'assist' }).eq('tenant_id', TENANT_A)
  await maybeSuggestLabels(admin, TENANT_A, thread.id, 'assist', classifyResult.suggestedLabelIds, classifyResult.model)

  const { data: suggestionsAfterAssist } = await admin
    .from('email_label_suggestions')
    .select('id, label_id, email_labels(name)')
    .eq('thread_id', thread.id)
  const { data: assignmentsAfterAssist } = await getLabelAssignmentsForThread(admin, TENANT_A, thread.id)
  console.log('Pending suggestions after assist-mode run:', JSON.stringify(suggestionsAfterAssist, null, 2))
  console.log(`Assignments after assist-mode run (should be 0, not auto-applied): ${assignmentsAfterAssist?.length ?? 0}`)

  // ── Item 3 + FIX #3: graduate to auto_send, re-run — auto-applies AND
  // cleans up the stale suggestion from step 2 ──────────────────────────────
  log('3. GRADUATED (auto_send): re-run on same thread — auto-applies, no review step, stale suggestion cleaned up (FIX #3)')
  await admin.from('tenant_settings').update({ ai_quoting_mode: 'auto_send' }).eq('tenant_id', TENANT_A)
  console.log('resolveLabelAutoApply(auto_send):', resolveLabelAutoApply('auto_send'), '| resolveLabelAutoApply(assist):', resolveLabelAutoApply('assist'))

  const classifyResult2 = await adapter.classify({ systemPrompt, threadText, defaultLabels: defaultLabels ?? [] })
  await maybeSuggestLabels(admin, TENANT_A, thread.id, 'auto_send', classifyResult2.suggestedLabelIds, classifyResult2.model)

  const { data: suggestionsAfterAutoSend } = await admin.from('email_label_suggestions').select('id').eq('thread_id', thread.id)
  const { data: assignmentsAfterAutoSend } = await getLabelAssignmentsForThread(admin, TENANT_A, thread.id)
  console.log(`Stale suggestions remaining after auto_send run (FIX #3 — should be 0): ${suggestionsAfterAutoSend?.length ?? 0}`)
  console.log('Real assignments after auto_send run:', JSON.stringify(assignmentsAfterAutoSend, null, 2))

  // ── Item 9: domain_events ────────────────────────────────────────────────
  log('4. Real domain_events row for email.label_added')
  const { data: events } = await admin
    .from('domain_events')
    .select('id, event_type, source_module, payload, created_at')
    .eq('tenant_id', TENANT_A)
    .eq('event_type', 'email.label_added')
    .order('created_at', { ascending: false })
    .limit(3)
  console.log('Recent email.label_added domain_events:', JSON.stringify(events, null, 2))

  // ── Item 4: custom label never suggested ────────────────────────────────
  log('5. Custom label is structurally excluded from AI suggestions')
  const customLabelName = `Custom Test Label ${Date.now()}`
  const { data: customLabel } = await createLabel(admin, TENANT_A, { name: customLabelName, color_hex: '#7F1D1D' })
  const { data: defaultLabelsAfterCustomCreate } = await getDefaultLabels(admin, TENANT_A)
  const customLabelInClosedSet = (defaultLabelsAfterCustomCreate ?? []).some((l) => l.id === customLabel?.id)
  console.log(`Custom label "${customLabelName}" appears in the closed set passed to Gemini: ${customLabelInClosedSet} (expect false)`)
  const classifyResult3 = await adapter.classify({ systemPrompt, threadText, defaultLabels: defaultLabelsAfterCustomCreate ?? [] })
  console.log('suggestedLabelIds after custom label exists:', classifyResult3.suggestedLabelIds, `(custom label id ${customLabel?.id} must never appear)`)
  console.log(`Custom label ever suggested: ${classifyResult3.suggestedLabelIds.includes(customLabel!.id)} (expect false)`)
  await admin.from('email_labels').delete().eq('id', customLabel!.id)

  // ── Restore real tenant state ───────────────────────────────────────────
  await admin.from('tenant_settings').update({ ai_quoting_mode: originalMode }).eq('tenant_id', TENANT_A)
  console.log(`\nRestored Tenant A's ai_quoting_mode back to real value: ${originalMode}`)
}

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
