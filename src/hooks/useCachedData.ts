
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCached,
  setCached,
  invalidateCache,
  onCacheInvalidation,
  getStale,
} from '../services/localCache';

interface UseCachedDataOptions {
  ttl?: number;
  enabled?: boolean;
  /** Aceito por compatibilidade — o comportamento SWR já é o padrão do hook */
  staleWhileRevalidate?: boolean;
}

interface UseCachedDataResult<T> {
  data: T | null;
  loading: boolean;
  isRevalidating: boolean;
  error: Error | null;
  retry: () => void;
  invalidate: () => void;
  isFromCache: boolean;
}

/**
 * Hook de cache com Stale-While-Revalidate:
 * - Retorna cache imediatamente (mesmo expirado) → sem loading spinner
 * - Busca dados frescos em background silenciosamente
 * - isLoading = true SOMENTE quando não há nenhum dado cacheado (primeiro acesso)
 * - isRevalidating = true quando está atualizando em background com dado stale exibido
 * - Escuta invalidações externas para re-buscar automaticamente
 */
export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
  const { ttl = 5 * 60 * 1000, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Mantém referência estável da função de fetch entre renders
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const retry = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const invalidate = useCallback(async () => {
    try {
      await invalidateCache(cacheKey);
    } catch (invErr) {
      console.warn('[useCachedData] Falha ao invalidar cache:', cacheKey, invErr);
    } finally {
      setFetchTrigger((prev) => prev + 1);
    }
  }, [cacheKey]);

  // Carrega dados (cache → stale → fetch)
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setError(null);

      try {
        // 1️⃣ Tenta obter cache válido (não expirado)
        const cached = await getCached<T>(cacheKey);

        if (cached !== null) {
          if (!cancelled) {
            setData(cached);
            setIsFromCache(true);
            setLoading(false);
            setIsRevalidating(false);
          }
          return;
        }

        // 2️⃣ Tenta obter cache stale (expirado, mas ainda presente)
        const stale = await getStale<T>(cacheKey);

        if (stale !== null) {
          if (!cancelled) {
            setData(stale);
            setIsFromCache(true);
            setLoading(false);
            setIsRevalidating(true); // Indica revalidação em background
          }

          // Busca o dado fresco em background
          try {
            const freshData = await fetchFnRef.current();
            if (!cancelled) {
              setData(freshData);
              setIsFromCache(false);
              setIsRevalidating(false);
              await setCached(cacheKey, freshData, ttl);
            }
          } catch (bgErr) {
            if (!cancelled) {
              setIsRevalidating(false);
              console.warn('[useCachedData] Falha na revalidação background:', cacheKey, bgErr);
            }
          }
          return;
        }

        // 3️⃣ Miss total – mostra loading até obter dados frescos
        if (!cancelled) {
          setLoading(true);
        }

        const freshData = await fetchFnRef.current();

        if (!cancelled) {
          setData(freshData);
          setIsFromCache(false);
          setLoading(false);
          setIsRevalidating(false);
          await setCached(cacheKey, freshData, ttl);
        }
      } catch (err) {
        if (!cancelled) {
          const e = err instanceof Error ? err : new Error('Erro ao carregar dados');
          setError(e);
          setLoading(false);
          setIsRevalidating(false);
          console.error('[useCachedData] Erro:', cacheKey, e.message);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, ttl, fetchTrigger]);

  // Escuta invalidações externas (ex.: Realtime)
  useEffect(() => {
    const unsubscribe = onCacheInvalidation((keys: string[]) => {
      if (keys.includes(cacheKey)) {
        setFetchTrigger((prev) => prev + 1);
      }
    });
    return unsubscribe;
  }, [cacheKey]);

  return {
    data,
    loading,
    isRevalidating,
    error,
    retry,
    invalidate,
    isFromCache,
  };
}
