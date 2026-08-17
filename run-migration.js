require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const dns = require('dns');

async function runMigration() {
  const sql = fs.readFileSync('supabase/migrations/20260817040000_admin_users.sql', 'utf8');
  
  dns.lookup('db.scnvcifnziempvprenhp.supabase.co', { family: 4 }, async (err, address) => {
    if (err) {
      console.error('DNS Lookup failed:', err);
      return;
    }
    console.log('IPv4 Address:', address);
    
    // Replace the host in the DATABASE_URL with the IPv4 address
    let connStr = process.env.DATABASE_URL;
    connStr = connStr.replace('db.scnvcifnziempvprenhp.supabase.co', address);
    // Force port to 6543 for pooler
    connStr = connStr.replace(':5432', ':6543');
    
    const client = new Client({ connectionString: connStr });
    try {
      await client.connect();
      await client.query(sql);
      console.log('Migration applied successfully');
    } catch (error) {
      console.error('Error applying migration:', error);
    } finally {
      await client.end();
    }
  });
}

runMigration();
