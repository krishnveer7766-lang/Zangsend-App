import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const POLL_INTERVAL_MS = 3000; // 3 seconds between server calls
const COOLDOWN_MS = 2000; // Minimum time between processing cycles

export function useQueueProcessor() {
  const lastProcessedRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);

  useEffect(() => {
    let isRunning = false;
    
    const processDueEmailsClientSide = async (): Promise<number> => {
      const nowIso = new Date().toISOString();
      const { data: dueEmails, error } = await supabase
        .from('contacts')
        .select('*, template:templates(*)')
        .eq('status', 'scheduled')
        .lte('scheduled_send_at', nowIso)
        .order('scheduled_send_at', { ascending: true })
        .limit(3);

      if (error || !dueEmails || dueEmails.length === 0) return 0;

      let sentCount = 0;
      for (const email of dueEmails) {
        const activity = (email.data?.activity || {}) as Record<string, string>;

        const { data: claimed } = await supabase
          .from('contacts')
          .update({
            status: 'processing',
            data: {
              ...(email.data || {}),
              activity: { ...activity, processing_at: new Date().toISOString() }
            }
          })
          .eq('id', email.id)
          .eq('status', 'scheduled')
          .select()
          .single();

        if (!claimed) continue;

        try {
          const senderId = claimed.sender_id || claimed.data?.sender_id;
          if (!senderId) throw new Error('Sender ID missing');

          const { data: sender } = await supabase
            .from('senders')
            .select('*')
            .eq('id', senderId)
            .single();

          if (!sender) throw new Error('Sender not found');

          let subject = email.template?.subject || email.subject || 'No Subject';
          let html = email.template?.body || email.body || '';
          const senderName = sender.name || sender.sender_name || undefined;

          html = html
            .replace(/\{\{first_name\}\}/g, email.first_name || '')
            .replace(/\{\{last_name\}\}/g, email.last_name || '')
            .replace(/\{\{company_name\}\}/g, email.company_name || '')
            .replace(/\{\{title\}\}/g, email.title || '');

          subject = subject
            .replace(/\{\{first_name\}\}/g, email.first_name || '')
            .replace(/\{\{last_name\}\}/g, email.last_name || '')
            .replace(/\{\{company_name\}\}/g, email.company_name || '')
            .replace(/\{\{title\}\}/g, email.title || '');

          // Resolve attachment: contact attachment first, then template attachment fallback.
          let attachment: any = null;
          const templateAttachmentIds = Array.isArray(email.template?.attachment_ids)
            ? email.template.attachment_ids
            : [];
          const targetAttachmentId = email.attachment_id || templateAttachmentIds[0];
          if (targetAttachmentId) {
            const { data: attachmentInfo } = await supabase
              .from('attachments')
              .select('id, filename, storage_path')
              .eq('id', targetAttachmentId)
              .single();

            if (attachmentInfo?.storage_path) {
              const { data: fileBlob, error: downloadError } = await supabase
                .storage
                .from('attachments')
                .download(attachmentInfo.storage_path);

              if (!downloadError && fileBlob) {
                const buf = await fileBlob.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                attachment = {
                  filename: attachmentInfo.filename || 'Attachment',
                  content: btoa(binary),
                  encoding: 'base64'
                };
              }
            }
          }

          const response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            body: JSON.stringify({
              to: email.email,
              subject,
              html,
              from_email: sender.email,
              app_password: sender.app_password,
              sender_name: senderName,
              contact_id: email.id,
              attachment
            })
          });
          if (!response.ok) throw new Error('Netlify send failed');
          await response.json();

          const now = new Date().toISOString();
          await supabase
            .from('contacts')
            .update({
              status: 'sent',
              sent_at: now,
              data: {
                ...(claimed.data || {}),
                activity: { ...(claimed.data?.activity || {}), sent_at: now }
              }
            })
            .eq('id', email.id);
          sentCount++;
        } catch (e: any) {
          await supabase
            .from('contacts')
            .update({
              status: 'bounced',
              data: {
                ...(claimed.data || {}),
                last_error: e?.message || 'Unknown send error',
                activity: { ...(claimed.data?.activity || {}), failed_at: new Date().toISOString() }
              }
            })
            .eq('id', email.id);
        }
      }

      return sentCount;
    };

    const callServerQueue = async () => {
      // Prevent calls if we're in cooldown period
      if (cooldownRef.current) {
        return;
      }

      // Debounce: don't call more than once every 2 seconds
      const now = Date.now();
      if (now - lastProcessedRef.current < COOLDOWN_MS) {
        return;
      }

      if (isRunning) return;
      isRunning = true;

      try {
        let processedCount = 0;
        
        // Try Netlify function first
        try {
          const response = await fetch('/.netlify/functions/process-queue', { method: 'POST' });
          if (response.ok) {
            const data = await response.json();
            console.log('[Queue] Netlify response:', data);
            processedCount = Number(data?.count ?? 0);
          } else {
            throw new Error('Netlify function failed');
          }
        } catch (netlifyErr) {
          console.error('[Queue] Netlify error, falling back to client-side queue:', netlifyErr);
          processedCount = await processDueEmailsClientSide();
        }
        
        if (processedCount > 0) {
          console.log(`[Queue] Processed ${processedCount} email(s)`);
          // Set cooldown to prevent rapid re-processing
          cooldownRef.current = true;
          setTimeout(() => {
            cooldownRef.current = false;
          }, COOLDOWN_MS);
        }

        lastProcessedRef.current = Date.now();

      } catch (err) {
        console.error('[Queue] Call error:', err);
      } finally {
        isRunning = false;
      }
    };

    // Poll the server queue every few seconds
    const interval = setInterval(callServerQueue, POLL_INTERVAL_MS);

    // Also run once on startup
    callServerQueue();

    return () => clearInterval(interval);
  }, []);
}
