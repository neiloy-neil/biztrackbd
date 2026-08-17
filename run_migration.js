require('dotenv').config({path: '.env.local'});
const { Client } = require('pg');
const fs = require('fs');
const url = process.env.DATABASE_URL.replace(/"/g, '');
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
client.connect().then(() => {
  const sql = fs.readFileSync('supabase/migrations/20260818100000_credit_sale_and_pos_fix.sql', 'utf8');
  return client.query(sql);
}).then(() => {
  console.log('Migration Applied');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
