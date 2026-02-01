
import { useEffect, useState, useRef } from 'react';

type SSEState = 'CONNECTING' | 'OPEN' | 'CLOSED';

export const useSSE = <T>(url: string, onMessage?: (data: T) => void) => {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SSEState>('CLOSED');
  const [error, setError] = useState<Event | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage); // Keep ref to avoid reconnect loop if callback changes

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const baseDelay = 1000;

  useEffect(() => {
    connect();

    return () => {
      close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const connect = () => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    setStatus('CONNECTING');
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus('OPEN');
      retryCountRef.current = 0;
      console.log('SSE Connected');
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (onMessageRef.current) {
          onMessageRef.current(parsed);
        }
        setData(parsed); // Still update local state for simple usage
      } catch (e) {
        console.error('Failed to parse SSE data', e);
      }
    };

    es.onerror = (e) => {
      console.error('SSE Error', e);
      setError(e);
      es.close();
      setStatus('CLOSED');

      // Exponential Backoff
      const delay = Math.min(baseDelay * Math.pow(2, retryCountRef.current), 30000);
      retryCountRef.current++;

      console.log(`Reconnecting in ${delay}ms...`);
      setTimeout(() => {
        connect();
      }, delay);
    };
  };

  const close = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStatus('CLOSED');
    }
  };

  return { data, status, error };
};
