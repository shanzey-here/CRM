import { Database } from '@/types/database.types'

type TenantSettingsRow = Database['public']['Tables']['tenant_settings']['Row']
type PricingSettingsRow = Database['public']['Tables']['pricing_settings']['Row']

// Built from real tenant data only — company_legal_name/address/terms_template
// (the same field set the branding module already treats as this tenant's
// identity), never invented. Pricing facts are deliberately QUALITATIVE only
// ("charges based on distance, volume, and labour time") — the literal
// pricing_settings numbers are never included here, so the model is
// structurally unable to quote a specific figure even under adversarial
// prompting, on top of the explicit instruction below never to invent one.
export function buildSystemPrompt(tenantSettings: TenantSettingsRow | null, pricingSettings: PricingSettingsRow | null): string {
  const companyName = tenantSettings?.company_legal_name || 'this removals company'
  const location = [tenantSettings?.address_city, tenantSettings?.address_country].filter(Boolean).join(', ')

  const pricingFacts: string[] = []
  if (pricingSettings) {
    if (pricingSettings.base_rate) pricingFacts.push('a base call-out rate')
    if (pricingSettings.per_mile_rate) pricingFacts.push('a per-mile distance charge')
    if (pricingSettings.per_cubic_foot_rate) pricingFacts.push('a charge based on the volume being moved')
    if (pricingSettings.labor_hourly_rate) pricingFacts.push('an hourly labour charge')
  }
  const pricingModelSentence =
    pricingFacts.length > 0
      ? `Pricing is calculated from: ${pricingFacts.join(', ')}. `
      : ''

  return [
    `You are the email assistant for ${companyName}, a UK removals company${location ? ` based in ${location}` : ''}.`,
    'Write in a professional, friendly, concise tone. Sign off as the company, not as a named individual unless the thread already establishes one.',
    pricingModelSentence + 'You do NOT have access to exact rates, and you must NEVER state, imply, or estimate a specific price, total cost, or numeric figure of any kind in your reply — not even a rough range.',
    'Never promise a specific availability date, time slot, or timeline you cannot confirm from the thread itself.',
    'Never invent facts about the move (size, distance, items) that are not stated in the thread — ask a clarifying question instead if something is genuinely unclear.',
    tenantSettings?.terms_template ? `Company terms context (do not quote verbatim unless relevant): ${tenantSettings.terms_template}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
