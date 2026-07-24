import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  // Make sure we're not already on auto_send before this test.
  await service.from('tenant_settings').update({ ai_quoting_mode: 'quote_review' }).eq('tenant_id', TENANT_ID)

  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJar[name] = value }) } },
  })
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  console.log('=== Real Settings page render ===')
  const pageRes = await fetch('http://localhost:3000/office/settings/ai-assistant', { headers: { Cookie: cookieHeader } })
  const html = await pageRes.text()
  console.log('status:', pageRes.status)
  console.log('Contains disabled auto_send input?', /value="auto_send"[^>]*disabled/.test(html) || /disabled[^>]*value="auto_send"/.test(html))
  const progressMatch = html.match(/Available once you.{0,200}?unedited so far\.|Available once you.{0,100}?0\/20\./)
  console.log('Progress text found:', progressMatch ? progressMatch[0].replace(/\s+/g, ' ') : 'NOT FOUND — dumping snippet')
  if (!progressMatch) {
    const idx = html.indexOf('Available once')
    console.log('Snippet around "Available once":', html.slice(idx, idx + 300).replace(/\s+/g, ' '))
  }

  console.log('\n=== Real direct server-side attempt to set auto_send ===')
  const setRes = await fetch('http://localhost:3000/api/testautosend', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'setMode', mode: 'auto_send' }),
  })
  console.log('status:', setRes.status)
  console.log(JSON.stringify(await setRes.json(), null, 2))

  const { data: settings } = await service.from('tenant_settings').select('ai_quoting_mode').eq('tenant_id', TENANT_ID).single()
  console.log('\nActual DB mode after rejected attempt:', settings?.ai_quoting_mode)
}
main()
