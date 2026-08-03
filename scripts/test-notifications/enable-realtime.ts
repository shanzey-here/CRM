import { Client } from 'pg'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  
  await client.connect()
  console.log('Connected to DB')
  
  try {
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`)
    console.log('✅ Realtime enabled for notifications table!')
  } catch (err: any) {
    console.error('Error enabling realtime:', err.message)
  } finally {
    await client.end()
  }
}

run().catch(console.error)
