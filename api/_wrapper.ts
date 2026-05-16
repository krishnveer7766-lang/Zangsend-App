import { VercelRequest, VercelResponse } from '@vercel/node';

export interface NetlifyEvent {
  httpMethod: string;
  headers: any;
  queryStringParameters: any;
  body: string | null;
  isBase64Encoded: boolean;
  path?: string;
}

export default function wrap(handler: any) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const event: NetlifyEvent = {
      httpMethod: req.method || 'GET',
      headers: req.headers,
      queryStringParameters: req.query,
      body: req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : null,
      isBase64Encoded: false,
      path: req.url || ''
    };

    try {
      const result = await (handler as any)(event, {});
      
      if (result.headers) {
          Object.entries(result.headers).forEach(([key, value]) => {
              res.setHeader(key, value as string);
          });
      }

      if (result.isBase64Encoded && result.body) {
          res.status(result.statusCode || 200).send(Buffer.from(result.body, 'base64'));
      } else {
          res.status(result.statusCode || 200).send(result.body || '');
      }
    } catch (error: any) {
      console.error("Wrapper Error:", error);
      res.status(500).json({ error: error.message });
    }
  };
}
