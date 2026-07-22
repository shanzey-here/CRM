import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { publicLeadSubmissionSchema } from '@/modules/leads/schemas'
import { createLead } from '@/modules/leads/server/repository'

// Public, unauthenticated, internet-facing endpoint embedded on tenant
// websites. Different threat model than the rest of the app: no session, no
// RLS safety net (service-role client bypasses it), anyone including bots
// can hit this. Every access decision below is enforced explicitly in code.

// Allow-all is deliberate for this one route only: CORS only restricts
// browser JS, it does nothing against bots/curl hitting the endpoint
// directly, and there's no tenant-domain registry to allowlist against yet.
// The real gatekeeping is the non-guessable form key + rate limit + honeypot
// + strict validation below. Future upgrade path: a per-tenant
// allowed-origin column to scope this down once tenants register domains.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const RATE_LIMIT_WINDOW_MINUTES = 10
const RATE_LIMIT_PER_IP = 5
const RATE_LIMIT_PER_TENANT = 20

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

// Deliberately generic — never reveals whether a form key "almost" matched,
// never leaks internal ids, tenant existence, or stack traces.
function genericError(status: number, message = 'Unable to process submission.') {
  return jsonResponse({ error: message }, status)
}

function getClientIp(request: NextRequest): string {
  // Best-effort, not spoof-proof: x-forwarded-for is attacker-controllable
  // on requests that don't pass through a trusted proxy/edge layer.
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest, context: { params: Promise<{ formKey: string }> }) {
  const { formKey } = await context.params
  const supabase = createServiceRoleClient()
  const ip = getClientIp(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return genericError(400, 'Invalid request body.')
  }

  const parsed = publicLeadSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return genericError(400, 'Invalid submission — please check the required fields.')
  }
  // Any other field the client sent (including a spoofed tenant_id,
  // contact_id, or stage) is not in this schema and was already silently
  // dropped by .safeParse() above.
  const { company_website: honeypot, ...leadFields } = parsed.data

  // 1. Resolve formKey -> tenant_id ourselves. The client never supplies or
  // controls tenant_id directly, at any point below.
  const { data: formKeyRow } = await supabase
    .from('tenant_form_keys')
    .select('tenant_id')
    .eq('key', formKey)
    .eq('is_active', true)
    .maybeSingle()

  if (!formKeyRow) {
    await supabase.from('public_lead_submission_log').insert({ tenant_id: null, ip_address: ip, outcome: 'invalid_key' })
    return genericError(404, 'Not found.')
  }
  const tenantId = formKeyRow.tenant_id

  // 2. Rate limit, scoped both by IP and by tenant.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()

  const { count: ipCount } = await supabase
    .from('public_lead_submission_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', windowStart)

  const { count: tenantCount } = await supabase
    .from('public_lead_submission_log')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', windowStart)

  if ((ipCount ?? 0) >= RATE_LIMIT_PER_IP || (tenantCount ?? 0) >= RATE_LIMIT_PER_TENANT) {
    await supabase.from('public_lead_submission_log').insert({ tenant_id: tenantId, ip_address: ip, outcome: 'rate_limited' })
    return genericError(429, 'Too many submissions. Please try again later.')
  }

  // 3. Honeypot — a hidden field real visitors never fill. Return the same
  // generic success response and create nothing, so a bot never learns it
  // tripped anything (an error response would teach it to avoid this field).
  if (honeypot) {
    await supabase.from('public_lead_submission_log').insert({ tenant_id: tenantId, ip_address: ip, outcome: 'honeypot' })
    return jsonResponse({ success: true, message: 'Thank you — we will be in touch shortly.' }, 200)
  }

  // 4. Check max_leads usage limit for this tenant.
  // We use the service_role client to perform the count bypass because this
  // is an unauthenticated endpoint.
  const { checkTenantLimit } = await import('@/modules/subscriptions/server/entitlements')
  const limitCheck = await checkTenantLimit(supabase, tenantId, 'max_leads')
  if (!limitCheck.allowed) {
    await supabase.from('public_lead_submission_log').insert({ tenant_id: tenantId, ip_address: ip, outcome: 'rate_limited' })
    // The generic error explicitly prevents leaking that the tenant is out of quota.
    return genericError(403, 'This provider is currently unable to accept new inquiries.')
  }

  // 5. Find-or-create the contact within the resolved tenant, deduped by
  // email. KNOWN LIMITATION: this is a SELECT-then-INSERT with no unique
  // constraint on contacts.email, so two near-simultaneous submissions with
  // the same email could race and create two contacts. Acceptable for
  // realistic public-form traffic; not fixed in this branch.
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('email', leadFields.email)
    .maybeSingle()

  let contactId = existingContact?.id as string | undefined

  if (!contactId) {
    const { data: newContact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        type: 'residential',
        first_name: leadFields.first_name,
        last_name: leadFields.last_name ?? null,
        email: leadFields.email,
        phone: leadFields.phone ?? null,
      })
      .select('id')
      .single()

    if (contactErr || !newContact) {
      console.error('[public leads] Failed to create contact:', contactErr)
      await supabase.from('public_lead_submission_log').insert({ tenant_id: tenantId, ip_address: ip, outcome: 'validation_error' })
      return genericError(500)
    }
    contactId = newContact.id
  }

  // 5. Create the lead via the existing, tested repository function.
  const { data: lead, error: leadErr } = await createLead(supabase, tenantId, {
    contact_id: contactId,
    stage: 'inquiry',
    source: 'website_form',
    preferred_move_date: leadFields.preferred_move_date ?? null,
    notes: leadFields.notes ?? null,
  })

  if (leadErr || !lead) {
    console.error('[public leads] Failed to create lead:', leadErr)
    await supabase.from('public_lead_submission_log').insert({ tenant_id: tenantId, ip_address: ip, outcome: 'validation_error' })
    return genericError(500)
  }

  // 6. Emit the domain event via the existing event-bus function, using the
  // service-role-only tenant override (this route has no user session for
  // current_tenant_id() to resolve). Lead creation and event emission are
  // NOT atomic — if this fails after the lead already exists, we log it
  // server-side and still return success to the visitor. A real captured
  // lead must never be lost over an internal event-bus hiccup; the event
  // bus is a secondary notification path, not the source of truth.
  const { error: eventErr } = await supabase.rpc('emit_domain_event', {
    p_event_type: 'lead.created',
    p_source_module: 'leads',
    p_payload: { lead_id: lead.id, source: 'website_form' },
    p_tenant_id: tenantId,
  })
  if (eventErr) {
    console.error('[public leads] Failed to emit lead.created event:', eventErr)
  }

  await supabase.from('public_lead_submission_log').insert({ tenant_id: tenantId, ip_address: ip, outcome: 'created' })
  await supabase.from('tenant_form_keys').update({ last_used_at: new Date().toISOString() }).eq('key', formKey)

  return jsonResponse({ success: true, message: 'Thank you — we will be in touch shortly.' }, 200)
}
