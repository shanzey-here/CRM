const hoodiecrow = require('hoodiecrow-imap')

const PORT = 1144
const USER = 'support@tenant-b-test.example'
const PASS = 'tenantbpass'

const message =
  'From: buyer@tenant-b-test.example\r\n' +
  'To: support@tenant-b-test.example\r\n' +
  'Subject: Tenant B isolation test message\r\n' +
  'Message-Id: <tenant-b-msg-001@tenant-b-test.example>\r\n' +
  'Date: Wed, 22 Jul 2026 11:00:00 +0000\r\n' +
  '\r\n' +
  'This message belongs to Tenant B only.\r\n'

const server = hoodiecrow({
  plugins: ['ID', 'SASL-IR', 'NAMESPACE'],
  id: { name: 'hoodiecrow-tenant-b', version: '1.0' },
  users: { [USER]: { password: PASS } },
  storage: { INBOX: { messages: [{ raw: message }] } },
  debug: false,
})

server.listen(PORT, () => {
  console.log(`hoodiecrow Tenant B test IMAP server listening on 127.0.0.1:${PORT} (user=${USER})`)
})
