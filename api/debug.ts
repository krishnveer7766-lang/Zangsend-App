import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
    const debugInfo = {
        envKeys: Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY')),
        hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeVersion: process.version,
    };

    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data, error } = await supabase.from('contacts').select('count', { count: 'exact', head: true });
        
        res.status(200).json({
            status: "ok",
            debugInfo,
            supabaseTest: error ? { error: error.message } : { success: true, data }
        });
    } catch (err: any) {
        res.status(500).json({
            status: "error",
            debugInfo,
            error: err.message,
            stack: err.stack
        });
    }
}
