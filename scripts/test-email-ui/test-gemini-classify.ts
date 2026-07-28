import { config } from 'dotenv'
config({ path: '.env.local' })
import { getLlmAdapter } from '../../src/modules/ai-email/provider'

async function main() {
  const adapter = getLlmAdapter()
  const systemPrompt = 'You are the email assistant for Dev Test Removals, a UK removals company.'

  const routine = '[Customer — test@example.com]\njust confirming the move is still on for the 15th'
  const quoteNeeding = '[Customer — test@example.com]\nwhat would it run me to move a 2-bed to Leeds'

  console.log('--- Routine message ---')
  const r1 = await adapter.classify({ systemPrompt, threadText: routine })
  console.log(JSON.stringify(r1, null, 2))

  console.log('\n--- Quote-needing message ---')
  const r2 = await adapter.classify({ systemPrompt, threadText: quoteNeeding })
  console.log(JSON.stringify(r2, null, 2))
}
main().catch((err) => console.error('ERROR:', err))
