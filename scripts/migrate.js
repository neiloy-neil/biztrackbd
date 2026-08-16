const { Client } = require('pg');
const fs = require('fs');

async function migrate() {
  const client = new Client({
    connectionString: 'postgresql://postgres:123biztrack123@db.scnvcifnziempvprenhp.supabase.co:5432/postgres'
  });

  try {
    await client.connect();
    console.log('Connected to Supabase Postgres');
    
    const schemaSql = fs.readFileSync('./supabase/schema.sql', 'utf8');
    await client.query(schemaSql);
    console.log('schema.sql executed successfully');

    const triggerSql = fs.readFileSync('./supabase/setup_trigger.sql', 'utf8');
    await client.query(triggerSql);
    console.log('setup_trigger.sql executed successfully');
    
  } catch (err) {
    console.error('Error executing SQL', err);
  } finally {
    await client.end();
  }
}

migrate();
