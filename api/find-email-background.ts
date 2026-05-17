import { handler } from '../netlify/functions/find-email-background';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { NetlifyEvent } from './_wrapper';

export default async function (req: VercelRequest, res: VercelResponse) {
    const event: NetlifyEvent = {
        body: JSON.stringify(req.body),
        headers: req.headers as any,
        httpMethod: req.method || 'GET',
        queryStringParameters: req.query as any,
        path: req.url || '',
        isBase64Encoded: false
    };
    try {
        const result = await (handler as any)(event, {});
        res.status(result.statusCode || 200).send(result.body);
    } catch (error: any) {
        res.status(500).send(error.message);
    }
}
