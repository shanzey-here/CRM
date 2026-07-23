import { ImapFlow } from 'imapflow'

const replyMessage =
  'From: support@dev-test-removals.example\r\n' +
  'To: customer@generic-imap-test.example\r\n' +
  'Subject: Re: Question about weekend moves\r\n' +
  'Message-Id: <reply-message-002@dev-test-removals.example>\r\n' +
  'In-Reply-To: <first-message-001@generic-imap-test.example>\r\n' +
  'References: <first-message-001@generic-imap-test.example>\r\n' +
  'Date: Wed, 22 Jul 2026 10:00:00 +0000\r\n' +
  '\r\n' +
  'Yes, we do Saturday moves! Let me know what date works.\r\n'

async function main() {
  const client = new ImapFlow({
    host: '127.0.0.1',
    port: 1143,
    secure: false,
    auth: { user: 'support@dev-test-removals.example', pass: 'testpass' },
    logger: false,
  })

  await client.connect()
  await client.append('INBOX', replyMessage)
  await client.logout()
  console.log('Reply message appended to hoodiecrow INBOX via real IMAP APPEND')
}

main()
