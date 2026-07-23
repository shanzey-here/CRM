import { Client } from 'pg'
import fs from 'fs'

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres'
  })
  await client.connect()
  const sql = fs.readFileSync('supabase/migrations/00043_phase1_5_manual_suspension.sql', 'utf8')
  await client.query(sql)
  await client.end()
  console.log('Migration applied successfully')
}

run().catch(console.error)
