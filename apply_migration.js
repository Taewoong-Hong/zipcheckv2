/**
 * Apply migration to Supabase
 * Usage: node apply_migration.js
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gsiismzchtgdklvdvggu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaWlzbXpjaHRnZGtsdmR2Z2d1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzM1MTEyNSwiZXhwIjoyMDUyOTI3MTI1fQ.y3NxTkHHRmRMFJi_Vm2nGN3JzSN_aApgWADc_Q9L3G8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync('./db/migrations/003_chat_analysis_system.sql', 'utf-8');

    console.log('Applying migration to Supabase...');

    // Split by semicolons and execute statements one by one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments
      if (statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }

      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
      console.log(statement.substring(0, 100) + '...');

      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error(`Error on statement ${i + 1}:`, error.message);
        // Continue to next statement
      } else {
        console.log(`✓ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
