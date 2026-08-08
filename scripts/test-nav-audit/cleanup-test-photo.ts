import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const photoId = 'af47dc82-b006-478b-8676-028a85e0e3b3'
  const storagePath = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1/204844af-ad55-4d73-b91c-2188e0e587c6/daea96e0-031b-4dbf-abd4-31bfbc2a1428.png'

  const { data: buckets } = await sc.storage.listBuckets()
  console.log('Buckets:', buckets?.map(b => b.name))

  for (const bucket of buckets || []) {
    const { error } = await sc.storage.from(bucket.name).remove([storagePath])
    if (!error) console.log('Removed from bucket:', bucket.name)
  }

  const { error: delErr } = await sc.from('job_photos').delete().eq('id', photoId)
  console.log('Deleted job_photos row:', delErr?.message || 'ok')
}
main()
