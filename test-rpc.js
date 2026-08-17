require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_platform_user_detail', { p_user_id: '212adb5c-02f3-41c0-a1a2-409ff0f68264' });
  console.log('RPC Call via JS Client:');
  console.log('Data:', data);
  console.log('Error Keys:', error ? Object.keys(error) : null);
  console.log('Error Message:', error ? error.message : null);
}

run();
