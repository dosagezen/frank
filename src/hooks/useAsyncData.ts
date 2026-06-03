import { useState, useEffect, useCallback, useRef, DependencyList } from 'react';

interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
}

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList = []
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMountedRef = useRef(true);

  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await fetchFn();
        
        if (!cancelled && isMountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
          const error = err instanceof Error ? err : new Error('Erro desconhecido');
          setError(error);
          console.error('useAsyncData error:', error);
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [...deps, retryCount]);

  return { data, loading, error, retry };
}
