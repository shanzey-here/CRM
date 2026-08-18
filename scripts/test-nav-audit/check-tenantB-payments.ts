import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const ids = ['c03770b2-e8f3-4657-9435-a69f199c23b8','4fa06773-6a85-4545-8d13-c2b5d8da7794','1a300b83-a498-44a4-bf21-b423327af89c','49c55bd4-a6eb-4916-9357-28b9dba5cb8b','202ab4ef-873d-4f9f-b05d-eb622f31c194']
  for (const id of ids) {
    const { data: payments } = await sc.from('payments').select('id').eq('invoice_id', id)
    console.log(id, '-> payments:', payments?.length)
  }
}
main()
