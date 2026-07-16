/**
 * Cross-tenant isolation test for the `updateLeadStage` Server Action path.
 *
 * This test verifies the repository-level tenant scoping that underpins the
 * Server Action: a dispatcher from Tenant A must NOT be able to update a lead
 * that belongs to Tenant B, even if they supply a valid UUID for that lead.
 *
 * We test at the repository layer (updateLead with explicit tenantId) rather
 * than invoking the Server Action directly, because the Server Action runs in
 * a Next.js server context. The tenant scoping logic is identical — the action
 * passes tenantId from the JWT and calls updateLead, which is what we test here.
 *
 * Run with:  npm run test:isolation
 */
import { createClient } from '@supabase/supabase-js'
import { createContact } from '../src/modules/clients/server/repository'
import { createLead, updateLead } from '../src/modules/leads/server/repository'

require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role bypasses RLS — lets us test repository-level tenant scoping explicitly
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

async function runTest() {
  console.log('--- Running updateLeadStage Cross-Tenant Isolation Test ---')

  let failed = false
  const createdLeadIds: string[] = []
  const createdContactIds: string[] = []

  try {
    // 1. Create prerequisite contacts (leads require a contact_id)
    const { data: contactA, error: caErr } = await createContact(supabase, TENANT_A, {
      first_name: 'Alice', last_name: 'Kanban', type: 'residential',
    })
    if (caErr || !contactA) throw new Error(`Failed to create contact A: ${caErr?.message}`)
    createdContactIds.push(contactA.id)

    const { data: contactB, error: cbErr } = await createContact(supabase, TENANT_B, {
      first_name: 'Bob', last_name: 'Kanban', type: 'residential',
    })
    if (cbErr || !contactB) throw new Error(`Failed to create contact B: ${cbErr?.message}`)
    createdContactIds.push(contactB.id)

    // 2. Create one lead per tenant
    const { data: leadA, error: laErr } = await createLead(supabase, TENANT_A, {
      contact_id: contactA.id, stage: 'inquiry',
    })
    if (laErr || !leadA) throw new Error(`Failed to create lead A: ${laErr?.message}`)
    createdLeadIds.push(leadA.id)

    const { data: leadB, error: lbErr } = await createLead(supabase, TENANT_B, {
      contact_id: contactB.id, stage: 'inquiry',
    })
    if (lbErr || !leadB) throw new Error(`Failed to create lead B: ${lbErr?.message}`)
    createdLeadIds.push(leadB.id)

    console.log(`Created Lead A (${leadA.id}) for Tenant A`)
    console.log(`Created Lead B (${leadB.id}) for Tenant B`)

    // 3. CORE TEST: Tenant A's dispatcher attempts to move Tenant B's lead.
    //    updateLead scopes by tenantId — it should return null data (not found)
    //    meaning the update silently no-ops (no rows matched the tenant filter).
    console.log('Attempting cross-tenant updateLead (Tenant A context, Tenant B lead ID)...')
    const { data: crossUpdateResult, error: crossErr } = await updateLead(
      supabase,
      TENANT_A,        // <-- Tenant A's context (as injected from their JWT)
      leadB.id,        // <-- Tenant B's lead ID (as if guessed/forged by client)
      { stage: 'confirmed_booking' }
    )

    if (crossUpdateResult) {
      console.error('FAIL: Cross-tenant updateLead returned data — Tenant A modified Tenant B lead!')
      failed = true
    } else {
      console.log('PASS: Cross-tenant updateLead correctly returned null (no rows matched).')
    }

    // 4. Verify Tenant B's lead is actually unchanged in the DB
    const { data: leadBCheck } = await supabase
      .from('leads')
      .select('stage')
      .eq('id', leadB.id)
      .single()

    if (leadBCheck?.stage !== 'inquiry') {
      console.error(`FAIL: Tenant B lead stage was mutated to "${leadBCheck?.stage}" by cross-tenant call!`)
      failed = true
    } else {
      console.log(`PASS: Tenant B lead stage is still "${leadBCheck?.stage}" — data was not modified.`)
    }

    // 5. Verify that a legitimate same-tenant update still works
    console.log('Verifying same-tenant update still works for Tenant A...')
    const { data: legitUpdate, error: legitErr } = await updateLead(
      supabase,
      TENANT_A,
      leadA.id,
      { stage: 'survey_scheduled' }
    )

    if (legitErr || !legitUpdate) {
      console.error('FAIL: Same-tenant update failed unexpectedly:', legitErr?.message)
      failed = true
    } else if (legitUpdate.stage !== 'survey_scheduled') {
      console.error(`FAIL: Expected stage "survey_scheduled", got "${legitUpdate.stage}"`)
      failed = true
    } else {
      console.log('PASS: Same-tenant updateLead correctly updated Lead A stage.')
    }

  } catch (err) {
    console.error('Test failed with unhandled exception:', err)
    failed = true
  } finally {
    // Cleanup — always runs even if assertions fail
    console.log('Cleaning up test data...')
    if (createdLeadIds.length > 0) {
      const { error: e } = await supabase.from('leads').delete().in('id', createdLeadIds)
      if (e) { console.error('WARNING: Lead cleanup failed:', e.message); failed = true }
    }
    if (createdContactIds.length > 0) {
      const { error: e } = await supabase.from('contacts').delete().in('id', createdContactIds)
      if (e) { console.error('WARNING: Contact cleanup failed:', e.message); failed = true }
    }
  }

  if (failed) {
    console.error('--- Test FAILED ---')
    process.exit(1)
  }

  console.log('--- All Tests Passed ---')
}

runTest()
