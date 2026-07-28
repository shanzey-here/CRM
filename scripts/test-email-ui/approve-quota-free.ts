import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const MESSAGE_ID = process.argv[2]
const ACTION = process.argv[3] // 'approve' or 'discard'
const EDITED_TEXT = process.argv[4]

async function main() {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJar[name] = value }) } },
  })
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const body: any = { action: ACTION, messageId: MESSAGE_ID }
  if (EDITED_TEXT) body.editedBodyText = EDITED_TEXT

  const res = await fetch('http://localhost:3000/api/testautosend', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  console.log('status:', res.status)
  console.log(JSON.stringify(await res.json(), null, 2))
}
main()
