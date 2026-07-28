import { config } from 'dotenv'
config({ path: '.env.local' })
import { getLlmAdapter } from '../../src/modules/ai-email/provider'
import { buildSystemPrompt } from '../../src/modules/ai-email/server/persona'

async function main() {
  const adapter = getLlmAdapter()
  const systemPrompt = buildSystemPrompt(
    { company_legal_name: 'Dev Test Removals', address_city: 'Manchester', address_country: 'GB', terms_template: null } as any,
    { base_rate: 100, per_mile_rate: 1, per_cubic_foot_rate: 0.5, labor_hourly_rate: 25 } as any
  )
  console.log('--- System prompt ---')
  console.log(systemPrompt)

  const threadText = '[Customer — test@example.com]\njust confirming the move is still on for the 15th'
  const result = await adapter.draft({ systemPrompt, threadText, toneSamples: [] })
  console.log('\n--- Draft result ---')
  console.log(JSON.stringify(result, null, 2))
}
main().catch((err) => console.error('ERROR:', err))
