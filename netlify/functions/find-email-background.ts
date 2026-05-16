import { BackgroundHandler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const APIFY_TOKENS = [
  process.env.APIFY_TOKEN || '',
  process.env.APIFY_TOKEN2 || '',
];
let currentTokenIndex = 0;
const getToken = () => APIFY_TOKENS[currentTokenIndex];
const rotateToken = () => {
  currentTokenIndex = (currentTokenIndex + 1) % APIFY_TOKENS.length;
};

const catchAll = (url: string) => ({
  urls: [url],
  profileUrls: [url],
  linkedinUrls: [url],
  startUrls: [{ url }],
  linkedin: url,
  linkedin_profile_url: url,
  url: url,
  includeEmail: true,
  extractEmail: true,
  findEmail: true,
  scrapeEmail: true,
});

const ACTOR_WATERFALL = [
  { id: 'snipercoder~linkedin-email-finder', input: (url: string) => ({ linkedin: url }) },
  { id: 'vulnv~linkedin-email-finder', input: (url: string) => ({ urls: [url] }) },
  { id: 'snipercoder~bulk-linkedin-email-finder', input: (url: string) => ({ linkedin: [url] }) },
  { id: 'anchor~linkedin-to-email', input: (url: string) => ({ startUrls: [{ url }] }) },
  { id: 'blitzapi~linkedin-email-finder', input: (url: string) => ({ linkedin_profile_url: url }) },
  { id: 'iron-crawler~linkedin-email-finder', input: catchAll },
  { id: 'api-empire~linkedin-profile-email-scraper', input: catchAll },
  { id: 'parvenu~email-enrichment', input: catchAll },
  { id: 'snipercoder~bulk-decision-makers-email-finder', input: catchAll },
  { id: 'snipercoder~decision-maker-email-finder', input: catchAll },
  { id: 'scraper-mind~linkedin-b2b-email-scraper', input: catchAll },
  { id: 'scraper-mind~linkedin-profiles-email-scraper', input: catchAll },
  { id: 'contacts-api~linkedin-profiles-email-scraper', input: catchAll },
  { id: 'unlimitedleadtestinbox~linkedin-email-scraper', input: catchAll },
  { id: 'x_guru~linkedin-email-Scraper-no-cookies', input: catchAll },
  { id: 'b2b_leads~linkedin-profile-scraper', input: catchAll },
  { id: 'tomba-io~linkedin-finder', input: catchAll },
  { id: 'khadinakbar~linkedin-profile-email-scraper', input: catchAll },
  { id: 'bhansalisoft~linkedin-email-scraper', input: catchAll },
  { id: 'dev_fusion~linkedin-profile-scraper', input: (url: string) => ({ profileUrls: [url] }) },
  { id: 'harvestapi~linkedin-profile-scraper', input: catchAll },
  { id: 'apify~mass-linkedin-profile-scraper', input: catchAll },
  { id: 'apimaestro~linkedin-profile-detail', input: catchAll },
  { id: 'apimaestro~linkedin-profile-batch-scraper-no-cookies-required', input: catchAll },
  { id: 'anchor~linkedin-profile-enrichment', input: catchAll },
];

async function startRun(actorId: string, input: any) {
  const token = getToken();
  const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const raw = await res.text();
  if (!res.ok) {
    if (res.status === 402 || res.status === 429 || raw.includes('quota') || raw.includes('limit')) {
      rotateToken();
      return { error: 'quota' };
    }
    return { error: raw.slice(0, 120) };
  }

  const d = JSON.parse(raw).data;
  return { runId: d.id, datasetId: d.defaultDatasetId };
}

async function pollRun(runId: string, token: string) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s: any = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })).json();
    const status = s.data?.status;
    if (status === 'SUCCEEDED') return true;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) return false;
  }
  return false;
}

async function fetchDataset(datasetId: string, token: string) {
  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return r.json();
}

function extractEmail(items: any) {
  if (!items || typeof items !== 'object') return null;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  let foundEmail: string | null = null;

  function scan(obj: any) {
    if (foundEmail) return;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (emailRegex.test(s)) foundEmail = s;
      else {
        const match = s.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) foundEmail = match[0];
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) scan(item);
    } else if (obj !== null && typeof obj === 'object') {
      for (const val of Object.values(obj)) scan(val);
    }
  }
  scan(items);
  return foundEmail ? foundEmail.toLowerCase() : null;
}

export const handler: BackgroundHandler = async (event) => {
  const { url, contact_id } = JSON.parse(event.body || '{}');
  if (!url || !contact_id) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  let email: string | null = null;

  for (const actor of ACTOR_WATERFALL) {
    if (email) break;
    try {
      const input = actor.input(url);
      let { runId, datasetId, error } = await startRun(actor.id, input);

      if (error === 'quota') {
        const retry = await startRun(actor.id, input);
        runId = retry.runId;
        datasetId = retry.datasetId;
        error = retry.error;
      }

      if (!error && runId && datasetId) {
        const ok = await pollRun(runId, getToken());
        if (ok) {
          const items = await fetchDataset(datasetId, getToken());
          email = extractEmail(items);
        }
      }
    } catch (err) {
      console.error(`Error with actor ${actor.id}:`, err);
    }
  }

  if (email) {
    await supabase.from('contacts').update({ email, status: 'email_found' }).eq('id', contact_id);
  } else {
    await supabase.from('contacts').update({ status: 'email_not_found' }).eq('id', contact_id);
  }
};
