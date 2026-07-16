import { createClient } from '@supabase/supabase-js'

// End-to-end HTTP test against a running `next dev` instance. Exercises the
// public, unauthenticated lead-capture endpoint's full threat model — not
// just the happy path. Requires:
//   - `npm run dev` running locally (default http://localhost:3000, override
//     with TEST_BASE_URL)
//   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//     NEXT_PUBLIC_SUPABASE_ANON_KEY set in the environment
//
// Runs against a shared, non-resettable database — creates its own
// dedicated, throwaway test tenants/fixtures and cleans them up in a
// `finally` block regardless of pass/fail, same standard as the other
// self-cleaning test scripts in this repo.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anonSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Dedicated synthetic IPs (RFC 5737 TEST-NET-3, never a real visitor) so the
// rate-limit test gets a clean counter, isolated from the other scenarios.
const IP_MAIN = '203.0.113.10'
const IP_RATE_LIMIT = '203.0.113.20'

let passCount = 0
let failCount = 0

function report(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passCount++
    console.log(`PASS: ${name}`)
  } else {
    failCount++
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function postLead(formKey: string, body: unknown, ip: string) {
  const res = await fetch(`${BASE_URL}/api/public/leads/${formKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
  let json: any = null
  try {
    json = await res.json()
  } catch {
    // non-JSON response — leave json null, caller will fail the assertion
  }
  return { status: res.status, json }
}

async function run() {
  console.log('--- Running Public Leads API Test ---')

  const tenantId = crypto.randomUUID()
  const otherTenantId = crypto.randomUUID() // a REAL other tenant, for the spoofing test
  let formKey: string | undefined
  const createdLeadIds: string[] = []
  const createdContactIds: string[] = []

  try {
    // ── Setup: two dedicated throwaway tenants + a form key ──────────────
    const { error: tenantErr } = await supabase.from('tenants').insert([
      { id: tenantId, name: 'Public API Test Tenant', slug: `public-api-test-${tenantId}`, status: 'active' },
      { id: otherTenantId, name: 'Public API Test Tenant (Other)', slug: `public-api-test-other-${otherTenantId}`, status: 'active' },
    ])
    if (tenantErr) throw new Error(`Setup failed creating test tenants: ${tenantErr.message}`)

    const { data: formKeyRow, error: formKeyErr } = await supabase
      .from('tenant_form_keys')
      .insert({ tenant_id: tenantId, label: 'test' })
      .select('key')
      .single()
    if (formKeyErr || !formKeyRow) throw new Error(`Setup failed creating form key: ${formKeyErr?.message}`)
    formKey = formKeyRow.key as string

    // ── Scenario 1: valid submission creates a lead in the correct tenant ─
    {
      const { status, json } = await postLead(formKey, {
        first_name: 'Alice',
        email: 'alice@example.com',
        phone: '07000000001',
      }, IP_MAIN)

      const ok1 = status === 200 && json?.success === true
      report('1. Valid submission returns success', ok1, JSON.stringify(json))

      const { data: lead } = await supabase
        .from('leads')
        .select('id, tenant_id, stage, source, contact_id')
        .eq('tenant_id', tenantId)
        .eq('source', 'website_form')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lead) createdLeadIds.push(lead.id)
      if (lead?.contact_id) createdContactIds.push(lead.contact_id)

      report(
        '1. Lead created in the correct tenant with stage=inquiry, source=website_form',
        !!lead && lead.tenant_id === tenantId && lead.stage === 'inquiry' && lead.source === 'website_form',
        JSON.stringify(lead)
      )

      // ── Scenario 7: exactly one domain_events row for this lead ─────────
      if (lead) {
        const { data: events } = await supabase
          .from('domain_events')
          .select('id, tenant_id, event_type, payload')
          .eq('event_type', 'lead.created')
          .contains('payload', { lead_id: lead.id })

        report(
          '7. Exactly one domain_events row emitted for the created lead, correct tenant_id',
          !!events && events.length === 1 && events[0].tenant_id === tenantId,
          JSON.stringify(events)
        )
      } else {
        report('7. Exactly one domain_events row emitted for the created lead, correct tenant_id', false, 'no lead found to check')
      }
    }

    // ── Scenario 2: invalid/garbage form key rejected generically ────────
    {
      const { status, json } = await postLead('not-a-real-key-000000', {
        first_name: 'Mallory',
        email: 'mallory@example.com',
      }, IP_MAIN)

      report(
        '2. Invalid form key rejected with generic error, no internal detail leaked',
        status === 404 && typeof json?.error === 'string' && !JSON.stringify(json).match(/tenant|key|uuid/i),
        `status=${status} body=${JSON.stringify(json)}`
      )
    }

    // ── Scenario 3: client-supplied tenant_id is ignored ──────────────────
    {
      const { status, json } = await postLead(formKey, {
        first_name: 'Spoofer',
        email: 'spoofer@example.com',
        tenant_id: otherTenantId, // attempted injection — must have zero effect
      }, IP_MAIN)

      const ok = status === 200 && json?.success === true
      report('3. Spoofed tenant_id submission still returns success', ok, JSON.stringify(json))

      const { data: lead } = await supabase
        .from('leads')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lead) createdLeadIds.push(lead.id)

      const { data: contact } = lead
        ? await supabase.from('contacts').select('id').eq('email', 'spoofer@example.com').eq('tenant_id', tenantId).maybeSingle()
        : { data: null }
      if (contact) createdContactIds.push(contact.id)

      report(
        '3. Spoofed tenant_id has no effect — lead created under the resolved (form key) tenant only',
        !!lead && lead.tenant_id === tenantId,
        JSON.stringify(lead)
      )

      const { count: otherTenantLeadCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', otherTenantId)

      report(
        '3. No lead was created under the spoofed (other) tenant',
        (otherTenantLeadCount ?? 0) === 0,
        `otherTenantLeadCount=${otherTenantLeadCount}`
      )
    }

    // ── Scenario 4: honeypot-filled submission is silently dropped ───────
    {
      const { status, json } = await postLead(formKey, {
        first_name: 'Bot',
        email: 'bot@example.com',
        company_website: 'https://spam.example.com', // honeypot — real visitors never fill this
      }, IP_MAIN)

      report('4. Honeypot submission still returns a generic success (no tip-off)', status === 200 && json?.success === true, JSON.stringify(json))

      const { data: botContact } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).eq('email', 'bot@example.com').maybeSingle()
      report('4. Honeypot submission created no contact/lead', !botContact, JSON.stringify(botContact))

      const { data: logRow } = await supabase
        .from('public_lead_submission_log')
        .select('outcome')
        .eq('tenant_id', tenantId)
        .eq('outcome', 'honeypot')
        .maybeSingle()
      report('4. Honeypot attempt logged with outcome=honeypot', !!logRow, JSON.stringify(logRow))
    }

    // ── Scenario 6: malformed payloads rejected cleanly, not with a 500 ──
    {
      const cases: Array<[string, unknown]> = [
        ['missing email', { first_name: 'NoEmail' }],
        ['malformed email', { first_name: 'BadEmail', email: 'not-an-email' }],
        ['missing first_name', { email: 'noFirstName@example.com' }],
      ]
      for (const [label, payload] of cases) {
        const { status, json } = await postLead(formKey, payload, IP_MAIN)
        report(`6. Malformed payload (${label}) rejected with 400, not 500`, status === 400 && typeof json?.error === 'string', `status=${status} body=${JSON.stringify(json)}`)
      }
    }

    // ── Scenario 5: rate limit trips after N rapid submissions (own IP) ──
    {
      let sawRateLimit = false
      let lastStatus = 0
      for (let i = 0; i < 6; i++) {
        const { status, json } = await postLead(formKey, {
          first_name: `RateTest${i}`,
          email: `ratetest${i}@example.com`,
        }, IP_RATE_LIMIT)
        lastStatus = status
        if (status === 200) {
          const { data: lead } = await supabase
            .from('leads')
            .select('id, contact_id')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (lead) {
            createdLeadIds.push(lead.id)
            if (lead.contact_id) createdContactIds.push(lead.contact_id)
          }
        }
        if (status === 429) {
          sawRateLimit = true
          report('5. Rate limit response carries no internal detail', typeof json?.error === 'string', JSON.stringify(json))
          break
        }
      }
      report('5. Rate limit triggers within 6 rapid submissions from the same IP', sawRateLimit, `lastStatus=${lastStatus}`)
    }

    // ── Scenario 8: non-service-role caller cannot override tenant_id ────
    {
      const { error } = await anonSupabase.rpc('emit_domain_event', {
        p_event_type: 'test.spoofed_tenant',
        p_source_module: 'test',
        p_payload: {},
        p_tenant_id: tenantId,
      })
      report(
        '8. emit_domain_event rejects a p_tenant_id override from a non-service-role (anon) caller',
        !!error && /service_role/i.test(error.message),
        error ? error.message : 'RPC unexpectedly succeeded'
      )
    }
  } catch (err) {
    failCount++
    console.error('Test run failed with unhandled exception:', err)
  } finally {
    console.log('Cleaning up test data...')
    if (createdLeadIds.length > 0) {
      await supabase.from('leads').delete().in('id', createdLeadIds)
    }
    if (createdContactIds.length > 0) {
      await supabase.from('contacts').delete().in('id', createdContactIds)
    }
    // Explicit IP-scoped log cleanup: catches rows with tenant_id NULL
    // (invalid-key attempts) that a tenant-cascade delete would never reach.
    await supabase.from('public_lead_submission_log').delete().in('ip_address', [IP_MAIN, IP_RATE_LIMIT])
    await supabase.from('domain_events').delete().in('tenant_id', [tenantId, otherTenantId])
    await supabase.from('tenant_form_keys').delete().eq('tenant_id', tenantId)
    await supabase.from('tenants').delete().in('id', [tenantId, otherTenantId])
  }

  console.log(`\n--- Results: ${passCount} passed, ${failCount} failed ---`)
  if (failCount > 0) {
    process.exit(1)
  }
}

run()
