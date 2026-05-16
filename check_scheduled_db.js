import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScheduled() {
    console.log("Checking scheduled contacts...");
    const { data, error } = await supabase
        .from('contacts')
        .select('id, email, status, scheduled_send_at')
        .not('scheduled_send_at', 'is', null);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} contacts with scheduled_send_at set:`);
    console.table(data);
}

checkScheduled();
