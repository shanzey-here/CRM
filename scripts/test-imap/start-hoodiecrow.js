// Real, protocol-level IMAP4rev1 test server (not a mock of our own code) —
// used to exercise the generic-IMAP sync path, including the
// In-Reply-To/References threading fallback that Gmail's own threadId
// bypasses. Author (andris9) also wrote imapflow/mailparser, the libraries
// the sync worker is built on.
const hoodiecrow = require('hoodiecrow-imap')

const PORT = process.env.HOODIECROW_PORT || 1143
const USER = 'support@dev-test-removals.example' // matches mailbox_address, per the "IMAP username = mailbox_address" design assumption
const PASS = 'testpass'

const firstMessage =
  'From: customer@generic-imap-test.example\r\n' +
  'To: support@dev-test-removals.example\r\n' +
  'Subject: Question about weekend moves\r\n' +
  'Message-Id: <first-message-001@generic-imap-test.example>\r\n' +
  'Date: Wed, 22 Jul 2026 09:00:00 +0000\r\n' +
  '\r\n' +
  'Hi, do you cover weekend moves? We need to move on a Saturday.\r\n'

const server = hoodiecrow({
  plugins: ['ID', 'SASL-IR', 'NAMESPACE', 'UIDPLUS'],
  id: { name: 'hoodiecrow-test', version: '1.0' },
  users: {
    [USER]: { password: PASS },
  },
  storage: {
    INBOX: {
      messages: [{ raw: firstMessage }],
    },
  },
  debug: false,
})

server.listen(PORT, () => {
  console.log(`hoodiecrow test IMAP server listening on 127.0.0.1:${PORT} (user=${USER})`)
})
