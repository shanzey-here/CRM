import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Auto-generated, frozen-at-completion record — distinct from job_signoffs
// (legal signature capture) and internal_notes/customer_notes (manual
// dispatcher free text). Compiled once from real, already-tracked data at
// the moment a job is genuinely completed. Never re-derived later: once
// written, this must not change even if the quote, catalog, or settings
// data it was built from changes afterward.
export interface JobCompletionSummary {
  generated_at: string
  job: {
    status: string
    move_date: string | null
    internal_notes: string | null
    customer_notes: string | null
  }
  customer: {
    name: string
    email: string | null
    phone: string | null
    company_name: string | null
  } | null
  addresses: {
    origin: AddressSnapshot | null
    destination: AddressSnapshot | null
  }
  quote: {
    total_price: number
    deposit_amount: number | null
    total_volume: number | null
    terms: string | null
  } | null
  inventory: Array<{
    item_name: string
    room: string | null
    quantity: number
    volume: number
  }>
  crew: Array<{
    name: string | null
    role: string
    scheduled_start: string
    scheduled_end: string
    actual_start: string | null
    actual_end: string | null
  }>
  vehicles: Array<{
    name: string
    type: string | null
    scheduled_start: string
    scheduled_end: string
  }>
  signoff: {
    signature_name: string
    signed_at: string
    document_hash: string
  } | null
  storage?: Array<{
    crate_number: string
    status: string
    rented_since: string | null
  }>
}

interface AddressSnapshot {
  line_1: string
  line_2: string | null
  city: string
  county: string | null
  postcode: string
  country: string
  access_notes: string | null
  floor_level: number | null
  has_lift: boolean | null
  parking_notes: string | null
}

function toAddressSnapshot(addr: any): AddressSnapshot | null {
  if (!addr) return null
  return {
    line_1: addr.line_1,
    line_2: addr.line_2,
    city: addr.city,
    county: addr.county,
    postcode: addr.postcode,
    country: addr.country,
    access_notes: addr.access_notes,
    floor_level: addr.floor_level,
    has_lift: addr.has_lift,
    parking_notes: addr.parking_notes,
  }
}

// Pure data-compilation function — throws on genuine failure so the caller
// can decide how to isolate it. Does not itself write anything.
//
// Uses a service-role client for its reads, not the caller's own session.
// This is a system-compiled artifact, not the crew member reading data
// themselves: crew's real RLS grants on quotes/contacts are scoped via
// LEAD assignment (leads.assigned_to), not job-crew assignment, so a job
// they're genuinely crew-assigned to (and just signed off) can still be
// invisible to their own session for quotes/contacts/addresses. Matches
// the exact precedent already in addJobSignoffAction, which uses its own
// admin client for the signature storage upload for the same reason.
// tenantId/jobId are still explicitly enforced on every query below —
// this bypasses RLS, not tenant scoping.
export async function compileJobCompletionSummary(
  _supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
): Promise<JobCompletionSummary> {
  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const supabase = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as unknown as SupabaseClient<Database>

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(`
      status, move_date, internal_notes, customer_notes, quote_id,
      contact:contacts(first_name, last_name, email, phone, company_name),
      origin_address:addresses!jobs_origin_address_fk(*),
      destination_address:addresses!jobs_destination_address_fk(*)
    `)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single()

  if (jobError || !job) {
    throw new Error(`Job not found for completion summary: ${jobError?.message ?? 'no data'}`)
  }

  // Quote + its own frozen inventory snapshot — item_name/volume live on
  // quote_inventory itself, captured at quote-creation time. Deliberately
  // NOT joining inventory_items (the live catalog) here, so this stays
  // immune to catalog edits made after the job is complete.
  let quote: JobCompletionSummary['quote'] = null
  let inventory: JobCompletionSummary['inventory'] = []
  if (job.quote_id) {
    const { data: quoteRow } = await supabase
      .from('quotes')
      .select('total_price, deposit_amount, total_volume, terms, quote_inventory(item_name, room, quantity, volume)')
      .eq('id', job.quote_id)
      .eq('tenant_id', tenantId)
      .single()

    if (quoteRow) {
      quote = {
        total_price: quoteRow.total_price,
        deposit_amount: quoteRow.deposit_amount,
        total_volume: quoteRow.total_volume,
        terms: quoteRow.terms,
      }
      inventory = (quoteRow.quote_inventory || []).map((qi: any) => ({
        item_name: qi.item_name,
        room: qi.room,
        quantity: qi.quantity,
        volume: qi.volume,
      }))
    }
  }

  const { data: crewAssignments } = await supabase
    .from('job_crew_assignments')
    .select('assignment_role, scheduled_start, scheduled_end, actual_start, actual_end, user:users(full_name)')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)

  const { data: vehicleAssignments } = await supabase
    .from('job_vehicle_assignments')
    .select('scheduled_start, scheduled_end, vehicle:vehicles(name, type)')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)

  // job_signoffs and crates aren't in the generated database.types.ts (the
  // types file lags behind real migrations in this project — confirmed
  // precedent from the field-expansion branch), so these two queries go
  // through an untyped client, matching that established pattern.
  const { data: signoffRow } = await (supabase as any)
    .from('job_signoffs')
    .select('signature_name, signed_at, document_hash')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: crateRows } = await (supabase as any)
    .from('crates')
    .select('crate_number, status, rented_since')
    .eq('job_id', jobId)
    .eq('tenant_id', tenantId)

  const contact = Array.isArray(job.contact) ? job.contact[0] : job.contact

  const summary: JobCompletionSummary = {
    generated_at: new Date().toISOString(),
    job: {
      status: job.status,
      move_date: job.move_date,
      internal_notes: job.internal_notes,
      customer_notes: job.customer_notes,
    },
    customer: contact
      ? {
          name: `${contact.first_name} ${contact.last_name || ''}`.trim(),
          email: contact.email,
          phone: contact.phone,
          company_name: contact.company_name,
        }
      : null,
    addresses: {
      origin: toAddressSnapshot(job.origin_address),
      destination: toAddressSnapshot(job.destination_address),
    },
    quote,
    inventory,
    crew: (crewAssignments || []).map((ca: any) => ({
      name: ca.user?.full_name ?? null,
      role: ca.assignment_role,
      scheduled_start: ca.scheduled_start,
      scheduled_end: ca.scheduled_end,
      actual_start: ca.actual_start,
      actual_end: ca.actual_end,
    })),
    vehicles: (vehicleAssignments || []).map((va: any) => ({
      name: va.vehicle?.name,
      type: va.vehicle?.type ?? null,
      scheduled_start: va.scheduled_start,
      scheduled_end: va.scheduled_end,
    })),
    signoff: signoffRow
      ? {
          signature_name: signoffRow.signature_name,
          signed_at: signoffRow.signed_at,
          document_hash: signoffRow.document_hash,
        }
      : null,
  }

  if (crateRows && crateRows.length > 0) {
    summary.storage = crateRows.map((c: any) => ({
      crate_number: c.crate_number,
      status: c.status,
      rented_since: c.rented_since,
    }))
  }

  return summary
}

// Compiles and persists the summary. Callers that need to isolate failure
// from a triggering action (e.g. crew sign-off) should wrap THIS call in
// their own try/catch — this function intentionally still throws on
// failure so direct/manual callers (e.g. a "Regenerate" action) get a real
// error to report, rather than a silently swallowed no-op.
export async function generateAndSaveJobCompletionSummary(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
): Promise<{ success: true; summary: JobCompletionSummary } | { success: false; error: string }> {
  const summary = await compileJobCompletionSummary(supabase, tenantId, jobId)

  // completion_summary/completion_summary_generated_at aren't in the
  // generated database.types.ts yet either — same lag as job_signoffs/crates.
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      completion_summary: summary,
      completion_summary_generated_at: summary.generated_at,
    } as any)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    throw new Error(`Failed to save completion summary: ${updateError.message}`)
  }

  return { success: true, summary }
}
