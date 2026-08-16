require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPC() {
  const { data, error } = await supabase.rpc('get_platform_businesses_list', {
    search_query: null,
    filter_status: null,
    filter_plan: null
  });
  console.log("Error:", error);
  console.log("Data:", data);
}

testRPC();
