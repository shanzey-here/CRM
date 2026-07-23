import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MAILBOX_ID = 'aa0c9a72-ed9e-4aa0-8679-f6ea1041ce6f'

async function main() {
  const { buildOutboundMessage, sendMessage } = await import('../../src/modules/mailboxes/server/send')

  const { data: mailbox } = await supabase.from('mailboxes').select('*').eq('id', MAILBOX_ID).single()

  const { raw, messageId } = buildOutboundMessage({
    from: mailbox!.mailbox_address!,
    to: 'customer@example-recipient.test',
    subject: 'Question about a Saturday move',
    bodyText: 'Yes, Saturday moves are available — real test send via nodemailer/SMTP.',
    inReplyTo: '<original-test@example-recipient.test>',
    references: '<original-test@example-recipient.test>',
  })

  console.log('Built raw message, generated Message-ID:', messageId)
  console.log('\n--- Raw RFC822 message ---')
  console.log(raw)

  const result = await sendMessage(supabase as any, mailbox!, raw, null, 'customer@example-recipient.test')
  console.log('\n--- Send result (real sendMessage() call against real Ethereal SMTP) ---')
  console.log(result)
}

main()
