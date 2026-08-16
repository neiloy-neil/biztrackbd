const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error('Please provide an SQL file path');
    process.exit(1);
  }

  const client = new Client({
    connectionString: 'postgresql://postgres:123biztrack123@db.scnvcifnziempvprenhp.supabase.co:5432/postgres'
  });

  try {
    await client.connect();
    console.log('Connected to DB');
    
    const sql = fs.readFileSync(file, 'utf8');
    await client.query(sql);
    console.log(`Executed ${path.basename(file)} successfully!`);
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
