import { handler } from '../netlify/functions/send-email';
import wrap from './_wrapper';
export default wrap(handler);
