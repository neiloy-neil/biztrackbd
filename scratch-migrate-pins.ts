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

  console.log(`Found ${users.users.length} users to migrate...`)
  
  for (const user of users.users) {
    console.log(`Updating password to '123456' for user ${user.email} (${user.id})`)
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password: '123456' })
    if (error) {
      console.error(`Failed to update ${user.email}:`, error.message)
    } else {
      console.log(`Success: ${user.email}`)
    }
  }

  console.log('Migration complete.')
}

run()
