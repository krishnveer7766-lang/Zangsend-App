import { Handler } from '@netlify/functions';

const APIFY_TOKENS = [
  process.env.APIFY_TOKEN || '',
  process.env.APIFY_TOKEN2 || '',
];
const getToken = () => APIFY_TOKENS[0];

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) return { statusCode: 400, body: 'URL required' };

    // Try a single fast actor for synchronous autofill
    const actorId = 'apimaestro~linkedin-profile-detail';
    const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${getToken()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
    });

    if (!res.ok) throw new Error('Apify start failed');
    const { data: run } = await res.json();
    
    // Wait up to 8s
    let items = null;
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${getToken()}`);
      const statusData = await statusRes.json();
      if (statusData.data.status === 'SUCCEEDED') {
        const itemRes = await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${getToken()}`);
        items = await itemRes.json();
        break;
      }
    }

    if (items && items.length > 0) {
      const p = items[0];
      const result = {
        first_name: p.first_name || p.firstName || p.name?.split(' ')[0] || null,
        last_name: p.last_name || p.lastName || p.name?.split(' ').slice(1).join(' ') || null,
        company_name: p.company || p.companyName || (p.experiences?.[0]?.company) || null,
        title: p.headline || p.title || (p.experiences?.[0]?.title) || null,
        email: p.email || null
      };
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(result),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'No immediate result, try background finding' }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
