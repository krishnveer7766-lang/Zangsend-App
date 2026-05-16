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
    
    console.log('Adding auth_type column to senders table...');
    await client.query("ALTER TABLE senders ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'app_password';");
    
    console.log('Setting auth_type to oauth for long passwords...');
    await client.query("UPDATE senders SET auth_type = 'oauth' WHERE length(app_password) > 50;");
    
    console.log('✅ Migration successful');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
