import { createServer } from 'http'

// Mimics Google's real token endpoint response for a revoked/expired
// refresh token: HTTP 400, JSON body {"error":"invalid_grant", ...} — this
// is Google's actual documented error shape for this exact scenario.
// Used by test-revoked-gmail-token.ts via GOOGLE_OAUTH_TOKEN_URL_OVERRIDE.
const server = createServer((req, res) => {
  res.writeHead(400, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }))
})

const PORT = 9987
server.listen(PORT, () => {
  console.log(`Fake Google token endpoint listening on http://127.0.0.1:${PORT}`)
})
