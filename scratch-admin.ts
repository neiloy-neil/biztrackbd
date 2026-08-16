import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()
  if (listError || !users?.users?.length) {
    console.log('No users found or error:', listError)
    return
  }

  // Find user by phone if present, or just first user
  const user = users.users.find(u => u.phone === '1712345678') || users.users[0]
  console.log(`Granting platform admin to ${user.phone || user.email} (${user.id})`)

  const { error } = await supabase
    .from('platform_admins')
    .insert({ user_id: user.id, role: 'super_admin' })

  if (error && error.code !== '23505') {
    console.error('Error:', error)
  } else {
    console.log('Success!')
  }
}

run()
