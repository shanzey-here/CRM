import { config } from 'dotenv'
config({ path: '.env.local' })
import { getLlmAdapter } from '../../src/modules/ai-email/provider'

async function main() {
  const adapter = getLlmAdapter()
  const result = await adapter.draft({
    systemPrompt: 'You are a test assistant.',
    threadText: '[Customer]\nHello, just a quota check.',
    toneSamples: [],
  })
  console.log('SUCCESS:', JSON.stringify(result, null, 2))
}
main().catch((err) => console.error('STILL FAILING:', err.message))
