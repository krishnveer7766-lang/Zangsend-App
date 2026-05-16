import { useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 3000; // 3 seconds between server calls
const COOLDOWN_MS = 2000; // Minimum time between processing cycles

export function useQueueProcessor() {
  const lastProcessedRef = useRef<number>(0);
  const cooldownRef = useRef<boolean>(false);

  useEffect(() => {
    let isRunning = false;

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
        const response = await fetch('/.netlify/functions/process-queue', { method: 'POST' });
        if (response.ok) {
          const data = await response.json();
          console.log('[Queue] Netlify response:', data);
          const processedCount = Number(data?.count ?? 0);
          
          if (processedCount > 0) {
            console.log(`[Queue] Processed ${processedCount} email(s)`);
            // Set cooldown to prevent rapid re-processing
            cooldownRef.current = true;
            setTimeout(() => {
              cooldownRef.current = false;
            }, COOLDOWN_MS);
          }
        } else {
          console.error('[Queue] Netlify function failed');
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
