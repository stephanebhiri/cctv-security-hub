import { useEffect, useRef } from 'react';

export const useAutoRefresh = (
  callback: () => void,
  interval: number,
  enabled: boolean
) => {
  const intervalRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (enabled) {
      intervalRef.current = window.setInterval(() => {
        callbackRef.current();
      }, interval);
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [interval, enabled]);

  // Pause when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else if (!document.hidden && enabled) {
        intervalRef.current = window.setInterval(() => {
          callbackRef.current();
        }, interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [interval, enabled]);
};