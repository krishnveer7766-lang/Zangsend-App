import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

export const handler: Handler = async (event) => {
  const { type, cid, url } = event.queryStringParameters || {};

  if (!cid) return { statusCode: 400, body: 'Missing contact id' };

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    if (type === 'open') {
      // Record open
      const { data: contact } = await supabase.from('contacts').select('data').eq('id', cid).single();
      const currentData = contact?.data || {};
      const activity = currentData.activity || {};
      
      if (!activity.opened_at) {
        await supabase.from('contacts').update({
          data: {
            ...currentData,
            activity: { ...activity, opened_at: now }
          }
        }).eq('id', cid);
      }
      
      // Return 1x1 transparent pixel
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'image/gif' },
        body: pixel.toString('base64'),
        isBase64Encoded: true,
      };
    } else if (type === 'click' && url) {
      // Record click
      const { data: contact } = await supabase.from('contacts').select('data').eq('id', cid).single();
      const currentData = contact?.data || {};
      const activity = currentData.activity || {};
      
      if (!activity.clicked_at) {
        await supabase.from('contacts').update({
          data: {
            ...currentData,
            activity: { ...activity, clicked_at: now }
          }
        }).eq('id', cid);
      }

      return {
        statusCode: 302,
        headers: { Location: url },
        body: '',
      };
    }

    return { statusCode: 400, body: 'Invalid track type' };
  } catch (err: any) {
    console.error('Track error:', err);
    return { statusCode: 500, body: err.message };
  }
};
