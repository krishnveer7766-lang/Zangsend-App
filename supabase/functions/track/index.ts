import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const type = url.searchParams.get('type') // 'open' or 'click'
  const cid = url.searchParams.get('cid') // contact id
  const targetUrl = url.searchParams.get('url') // for clicks

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  if (cid) {
    try {
      if (type === 'open') {
        console.log(`Tracking open for contact ${cid}`);
        await supabase
          .from('contacts')
          .update({ opened_at: new Date().toISOString() })
          .eq('id', cid);
      } else if (type === 'click') {
        console.log(`Tracking click for contact ${cid}`);
        await supabase
          .from('contacts')
          .update({ clicked_at: new Date().toISOString() })
          .eq('id', cid);
      }
    } catch (err) {
      console.error('Tracking DB update failed:', err);
    }
  }

  if (type === 'click' && targetUrl) {
    return Response.redirect(targetUrl, 302)
  }

  // Return 1x1 transparent pixel for open tracking
  const pixel = Uint8Array.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
  ])

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
