import { useEffect, useRef } from 'react';
import { localBackend } from '../localBackend';

export function useLocalBackend(onMessage: (message: { type: string; data: any }) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    return localBackend.subscribe((message) => onMessageRef.current(message));
  }, []);
}
