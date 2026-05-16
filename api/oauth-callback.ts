import { handler } from '../netlify/functions/oauth-callback';
import wrap from './_wrapper';
export default wrap(handler);
