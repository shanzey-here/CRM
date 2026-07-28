import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export interface PricingInput {
  tenantId: string
  quoteId: string
  totalVolume: number
  distanceMeters: number
  selectedSurcharges: string[]
}

export interface PricingBreakdown {
  volumeCost: number
  distanceCost: number
  labourCost: number
  surcharges: { key: string; amount: number }[]
  subtotal: number
  minimumAdjustment: number
  total: number
}

export interface PricingOutput {
  computedPrice: number
  breakdown: PricingBreakdown
}

/**
 * Calculate quote price based on tenant's pricing_settings.
 * One shared function, zero per-tenant code branching.
 * Returns both computed price and itemized breakdown.
 * Enforces draft-status guard at RPC level.
 */
export async function calculateQuotePrice(
  supabase: SupabaseClient<Database>,
  input: PricingInput
): Promise<{ success: boolean; result?: PricingOutput; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('calculate_quote_price', {
      p_tenant_id: input.tenantId,
      p_quote_id: input.quoteId,
      p_total_volume: input.totalVolume,
      p_distance_meters: input.distanceMeters,
      p_selected_surcharge_keys: input.selectedSurcharges,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'No pricing result returned' }
    }

    const row = data[0]

    // Fetch surcharge details from pricing_settings for breakdown
    const { data: settingsData } = await supabase
      .from('pricing_settings')
      .select('surcharges')
      .eq('tenant_id', input.tenantId)
      .single()

    let surchargesBreakdown: { key: string; amount: number }[] = []
    if (settingsData?.surcharges && input.selectedSurcharges.length > 0) {
      surchargesBreakdown = input.selectedSurcharges
        .map(key => {
          const surcharge = (settingsData.surcharges as any[]).find(
            s => s.key === key
          )
          return surcharge ? { key, amount: Number(surcharge.amount) } : null
        })
        .filter(Boolean) as { key: string; amount: number }[]
    }

    return {
      success: true,
      result: {
        computedPrice: Number(row.final_total),
        breakdown: {
          volumeCost: Number(row.volume_cost),
          distanceCost: Number(row.distance_cost),
          labourCost: Number(row.labour_cost),
          surcharges: surchargesBreakdown,
          subtotal: Number(row.subtotal),
          minimumAdjustment: Number(row.minimum_adjustment),
          total: Number(row.final_total),
        },
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Save pricing calculation and surcharge selections to the quote.
 * Stores computed_price (read-only) and upserts quote_surcharges records.
 */
export async function savePricingCalculation(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  computedPrice: number,
  selectedSurcharges: string[],
  breakdown: PricingBreakdown
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update computed_price on the quote
    const { error: updateError } = await supabase
      .from('quotes')
      .update({ computed_price: computedPrice })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Upsert quote_surcharges for selected surcharges
    if (selectedSurcharges.length > 0) {
      const surchargeRows = breakdown.surcharges.map(s => ({
        tenant_id: tenantId,
        quote_id: quoteId,
        surcharge_key: s.key,
        amount: s.amount,
      }))

      const { error: surchargeError } = await supabase
        .from('quote_surcharges')
        .upsert(surchargeRows, { onConflict: 'quote_id,surcharge_key' })

      if (surchargeError) {
        return { success: false, error: surchargeError.message }
      }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Set the final (override) price on a quote.
 * Can be set at any status, persists independently of computed_price.
 */
export async function setFinalPrice(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  finalPrice: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('quotes')
      .update({ final_price: finalPrice })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
