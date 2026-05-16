import { schedule } from '@netlify/functions';
import { processQueue } from './utils/queue';

export const handler = schedule('* * * * *', async () => {
  try {
    await processQueue();
    return { statusCode: 200 };
  } catch (err) {
    console.error('Scheduled queue error:', err);
    return { statusCode: 500 };
  }
});
