import { Client } from 'pg'
import fs from 'fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  })
  await client.connect()
  const sql = fs.readFileSync('supabase/migrations/00065_phase2_analytics_db.sql', 'utf8')
  await client.query(sql)
  await client.end()
  console.log('Analytics Migration applied successfully')
}

run().catch(console.error)
