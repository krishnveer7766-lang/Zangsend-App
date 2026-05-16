import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function processQueue() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Queue processor started...");
  try {
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    const { data: dueEmails, error: fetchError } = await supabase
      .from('contacts')
      .select('*, template:templates(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_send_at', now.toISOString())
      .order('scheduled_send_at', { ascending: true })
      .limit(10);

    if (fetchError || !dueEmails || dueEmails.length === 0) {
      console.log("No emails due.");
      return { count: 0 };
    }

    console.log(`Found ${dueEmails.length} emails to process.`);
    let sentCount = 0;

    for (const dueEmail of dueEmails) {
      const { data: claimed, error: claimError } = await supabase
        .from('contacts')
        .update({ status: 'processing' })
        .eq('id', dueEmail.id)
        .eq('status', 'scheduled')
        .select()
        .single();

      if (claimError || !claimed) continue;

      try {
        const senderId = claimed.sender_id || claimed.data?.sender_id;
        if (!senderId) throw new Error("Sender ID missing on contact");

        const { data: sender, error: senderError } = await supabase
          .from('senders')
          .select('*')
          .eq('id', senderId)
          .single();

        if (senderError || !sender) throw new Error("Sender not found");

        let body = dueEmail.template?.body || dueEmail.body || '';
        let subject = dueEmail.template?.subject || dueEmail.subject || 'No Subject';

        body = body
          .replace(/\{\{first_name\}\}/g, dueEmail.first_name || '')
          .replace(/\{\{last_name\}\}/g, dueEmail.last_name || '')
          .replace(/\{\{company_name\}\}/g, dueEmail.company_name || '')
          .replace(/\{\{title\}\}/g, dueEmail.title || '');

        const siteUrl = process.env.URL || 'https://zangsend.netlify.app';
        const trackingEndpoint = `${siteUrl}/api/track`;
        body = body.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi, (match, quote, url) => {
          if (url.startsWith('http')) {
            return `<a href="${trackingEndpoint}?type=click&cid=${dueEmail.id}&url=${encodeURIComponent(url)}"`;
          }
          return match;
        });
        body += `<img src="${trackingEndpoint}?type=open&cid=${dueEmail.id}" width="1" height="1" style="display:none !important;" />`;

        const attachments = [];
        const templateAttachmentIds = Array.isArray(dueEmail.template?.attachment_ids)
          ? dueEmail.template.attachment_ids
          : [];
        const targetAttachmentId = dueEmail.attachment_id || templateAttachmentIds[0];
        if (targetAttachmentId) {
          const { data: attachmentInfo } = await supabase.from('attachments').select('*').eq('id', targetAttachmentId).single();
          if (attachmentInfo?.storage_path) {
            const { data: fileData, error: downloadError } = await supabase.storage.from('attachments').download(attachmentInfo.storage_path);
            if (!downloadError && fileData) {
              const buffer = await fileData.arrayBuffer();
              attachments.push({
                filename: attachmentInfo.filename || 'Attachment',
                content: Buffer.from(buffer),
              });
            }
          }
        }

        const isOAuth = sender.app_password.length > 50;
        const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || '';
        
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: isOAuth ? {
            type: 'OAuth2',
            user: sender.email,
            clientId,
            clientSecret,
            refreshToken: sender.app_password
          } : {
            user: sender.email,
            pass: sender.app_password
          }
        });

        const fromHeader = (sender.name || sender.sender_name)
          ? `"${sender.name || sender.sender_name}" <${sender.email}>`
          : sender.email;

        await transporter.sendMail({
          from: fromHeader,
          to: dueEmail.email,
          subject,
          html: body,
          attachments
        });

        await supabase.from('contacts').update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        }).eq('id', dueEmail.id);
        sentCount++;

      } catch (err: any) {
        console.error(`Error processing ${dueEmail.email}:`, err.message);
        await supabase.from('contacts').update({ 
          status: 'bounced',
          data: { ...(dueEmail.data || {}), last_error: err.message }
        }).eq('id', dueEmail.id);
      }
    }
    return { count: sentCount };
  } catch (err: any) {
    console.error("Queue process error:", err.message);
    throw err;
  }
}
