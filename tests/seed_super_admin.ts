import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedSuperAdmin() {
  console.log('Seeding Super Admin...')

  const email = 'superadmin@gomove.com'
  const password = 'Password123!'
  const superAdminId = '99999999-9999-9999-9999-999999999999'

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      is_super_admin: true,
      tenant_role: null,
      tenant_id: null
    }
  })

  if (authError && authError.message.includes('already exists')) {
    console.log('User already exists in Auth. Updating their app_metadata...')
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const user = existingUsers.users.find(u => u.email === email)
    if (user) {
      await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: { is_super_admin: true, tenant_role: null, tenant_id: null }
      })
      // Upsert public.users
      await supabase.from('users').upsert({
        id: user.id,
        tenant_id: null,
        email: email,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'platform_admin'
      })
      console.log('Successfully updated existing Super Admin user.')
    }
  } else if (authData?.user) {
    // 3. Create public.users record
    await supabase.from('users').upsert({
      id: authData.user.id,
      tenant_id: null,
      email: email,
      first_name: 'Super',
      last_name: 'Admin',
      role: 'platform_admin'
    })
    console.log('Successfully created Super Admin user.')
  } else {
    console.error('Failed to create user:', authError)
  }

  console.log('-----------------------------------')
  console.log('✅ Super Admin Seeded!')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log('-----------------------------------')
}

seedSuperAdmin().catch(console.error)
