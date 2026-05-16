const fs = require('fs');
const functions = [
  'create-draft',
  'find-email',
  'get-senders',
  'oauth-callback',
  'process-queue',
  'send-email',
  'track',
  'find-email-background'
];

functions.forEach(f => {
  const content = `import { handler } from '../netlify/functions/${f}';
import wrap from './_wrapper';
export default wrap(handler);
`;
  fs.writeFileSync(`api/${f}.ts`, content);
});

const scheduledContent = `import { processQueue } from '../netlify/functions/utils/queue';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await processQueue();
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
`;
fs.writeFileSync('api/process-queue-scheduled.ts', scheduledContent);
