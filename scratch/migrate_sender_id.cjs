const { Client } = require('pg');
const connectionString = 'postgresql://postgres:nVfOd8PrZrV3UbzD@db.xhwpiagznwkoroitoulz.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB');
    
    console.log('Adding sender_id column to contacts table...');
    // Use TEXT first if we're not sure, then convert to UUID if possible
    await client.query("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES senders(id) ON DELETE SET NULL;");
    
    console.log('Migrating sender_id from JSON data (safe conversion)...');
    // Use a regex check for UUID format
    await client.query(`
      UPDATE contacts 
      SET sender_id = (data->>'sender_id')::uuid 
      WHERE sender_id IS NULL 
      AND data->>'sender_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    `);
    
    console.log('✅ Migration successful');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
