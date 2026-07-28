import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { getGmailAccessToken, getGmailClient } from '../../src/modules/mailboxes/server/gmail-oauth'
import { getDecryptedCredential } from '../../src/modules/mailboxes/server/repository'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const mailboxId = '37a0090f-9996-4fee-b513-b0e9fdd9180b'
  const refreshToken = await getDecryptedCredential(supabase as any, mailboxId)
  const tokenResult = await getGmailAccessToken(refreshToken)
  if (!('accessToken' in tokenResult)) { console.log('token error:', tokenResult); return }

  const gmail = getGmailClient(tokenResult.accessToken)
  const res = await gmail.users.messages.list({ userId: 'me', q: 'in:sent subject:"Testing mail 1"', maxResults: 5 })
  console.log('Gmail search results (in:sent):', JSON.stringify(res.data, null, 2))

  for (const m of res.data.messages ?? []) {
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata', metadataHeaders: ['Message-ID', 'To', 'Subject', 'Date'] })
    console.log('\n--- Sent message', m.id, '---')
    console.log('snippet:', full.data.snippet)
    console.log('headers:', full.data.payload?.headers)
  }
}
main()
