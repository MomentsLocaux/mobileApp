import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('📁 Reading migration file...');
        const migrationPath = path.join(__dirname, '../supabase/migrations/20260215_create_event_views.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        console.log('🚀 Executing migration...');

        // Split SQL into individual statements (rough split by semicolon)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';
            console.log(`  Executing statement ${i + 1}/${statements.length}...`);

            const { error } = await supabase.rpc('exec_sql', { sql_string: statement });

            if (error) {
                console.error(`❌ Error on statement ${i + 1}:`, error);
                throw error;
            }
        }

        console.log('✅ Migration completed successfully!');
        console.log('📊 The event_views table is now ready.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
