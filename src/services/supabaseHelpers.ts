import { supabase } from '../lib/supabaseClient';

// ✅ CACHE EM MEMÓRIA SIMPLIFICADO - TTL aumentado para 5 minutos
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos (era 5)

function getCacheKey(table: string, params: any): string {
  return `${table}_${JSON.stringify(params)}`;
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    console.log('[MemoryCache] Cache limpo completamente');
    return;
  }
  
  let cleared = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    console.log('[MemoryCache] Cache limpo:', pattern, `(${cleared} entradas)`);
  }
}

// ✅ Helper para parsear datas de forma segura
export function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  try {
    // Se já está no formato YYYY-MM-DD, retorna direto
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Tenta parsear e formatar
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (err) {
    console.warn('[parseDate] Erro ao parsear data:', dateStr, err);
    return null;
  }
}

// ✅ OTIMIZADO: Busca com cache opcional
export async function safeFetchMany<T = any>(
  fetchFn: () => Promise<{ data: T[] | null; error: any }>,
  options: { cache?: boolean; cacheKey?: string } = {}
): Promise<T[]> {
  try {
    // Verificar cache primeiro
    if (options.cache && options.cacheKey) {
      const cached = getFromCache(options.cacheKey);
      if (cached) {
        console.log('[MemoryCache] ✅ Hit:', options.cacheKey);
        return cached;
      }
    }

    const { data, error } = await fetchFn();
    
    if (error) {
      console.error('[FETCH ERROR]', error);
      return [];
    }
    
    const result = data ?? [];
    
    // Salvar no cache
    if (options.cache && options.cacheKey) {
      setCache(options.cacheKey, result);
    }
    
    return result;
  } catch (err) {
    console.error('[FETCH EXCEPTION]', err);
    return [];
  }
}

// ✅ OTIMIZADO: Busca única com cache
export async function safeFetchOne<T = any>(
  fetchFn: () => Promise<{ data: T | null; error: any }>,
  options: { cache?: boolean; cacheKey?: string } = {}
): Promise<T | null> {
  try {
    if (options.cache && options.cacheKey) {
      const cached = getFromCache(options.cacheKey);
      if (cached) {
        console.log('[MemoryCache] ✅ Hit:', options.cacheKey);
        return cached;
      }
    }

    const { data, error } = await fetchFn();
    
    if (error) {
      console.error('[FETCH ONE ERROR]', error);
      return null;
    }
    
    if (options.cache && options.cacheKey && data) {
      setCache(options.cacheKey, data);
    }
    
    return data;
  } catch (err) {
    console.error('[FETCH ONE EXCEPTION]', err);
    return null;
  }
}

// ✅ OTIMIZADO: Busca em batch (reduz queries N+1)
export async function batchFetch<T = any>(
  table: string,
  ids: string[],
  select: string = '*'
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();

  const uniqueIds = [...new Set(ids)];
  const cacheKey = getCacheKey(table, { ids: uniqueIds, select });
  
  // Verificar cache
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log('[MemoryCache] ✅ Batch hit:', table, uniqueIds.length, 'ids');
    return cached;
  }

  try {
    console.log('[BATCH FETCH]', table, uniqueIds.length, 'ids');
    
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in('id', uniqueIds);

    if (error) throw error;

    const resultMap = new Map<string, T>();
    (data || []).forEach((item: any) => {
      resultMap.set(item.id, item);
    });

    setCache(cacheKey, resultMap);
    return resultMap;
  } catch (err) {
    console.error('[BATCH FETCH ERROR]', table, err);
    return new Map();
  }
}

// ✅ OTIMIZADO: Busca relacionamentos em batch
export async function batchFetchRelated<T = any>(
  table: string,
  foreignKey: string,
  parentIds: string[],
  select: string = '*'
): Promise<Map<string, T[]>> {
  if (parentIds.length === 0) return new Map();

  const uniqueIds = [...new Set(parentIds)];
  const cacheKey = getCacheKey(table, { fk: foreignKey, ids: uniqueIds, select });
  
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log('[MemoryCache] ✅ Related hit:', table, uniqueIds.length, 'parents');
    return cached;
  }

  try {
    console.log('[BATCH RELATED]', table, uniqueIds.length, 'parents');
    
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in(foreignKey, uniqueIds);

    if (error) throw error;

    const resultMap = new Map<string, T[]>();
    (data || []).forEach((item: any) => {
      const parentId = item[foreignKey];
      if (!resultMap.has(parentId)) {
        resultMap.set(parentId, []);
      }
      resultMap.get(parentId)!.push(item);
    });

    setCache(cacheKey, resultMap);
    return resultMap;
  } catch (err) {
    console.error('[BATCH RELATED ERROR]', table, err);
    return new Map();
  }
}

// ✅ Helpers de usuário com cache
export async function getCurrentUser() {
  const cacheKey = 'current_user';
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) setCache(cacheKey, user);
  return user;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const cacheKey = `user_role_${user.id}`;
  const cached = getFromCache(cacheKey);
  if (cached !== null) return cached;

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = data?.role === 'admin';
  setCache(cacheKey, isAdmin);
  return isAdmin;
}
