const DB_NAME = 'app_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'cache_store';

interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.warn('[LocalCache] IndexedDB indisponivel, usando fallback em memoria');
      reject(request.error);
    };
  });
}

// Fallback em memória caso IndexedDB não esteja disponível
const memoryFallback = new Map<string, CacheEntry>();

async function getFromIDB<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return memoryFallback.get(key) as CacheEntry<T> | null || null;
  }
}

async function setToIDB<T>(entry: CacheEntry<T>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    memoryFallback.set(entry.key, entry);
  }
}

async function deleteFromIDB(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    memoryFallback.delete(key);
  }
}

async function clearAllIDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    memoryFallback.clear();
  }
}

// ✅ TTL AUMENTADO: 5 minutos (era 3)
const DEFAULT_TTL = 5 * 60 * 1000;

// Cache keys centralizadas
export const CACHE_KEYS = {
  PROJECTS: 'projects_list',
  PROJECTS_TEAMS: 'projects_teams',
  PROJECTS_PMS: 'projects_pms',
  PROJECTS_TASKS: 'projects_tasks',
  TASKS: 'tasks_list',
  TAREFAS_PROJECT_OPTIONS: 'tarefas-project-options',
  PROFILES: 'profiles_list',
  STATS: 'dashboard_stats',
  TEAM_MEMBERS: 'team_members',
  // Painel
  PAINEL_STATS: 'painel-stats',
  PAINEL_TASKS: 'painel-tasks',
  PAINEL_PROJECTS: 'painel-projects',
  PAINEL_DEADLINES: 'painel-deadlines',
  PAINEL_ACTIVITY: 'painel-activity',
  PAINEL_TEAM: 'painel-team',
  // Equipe
  EQUIPE_MEMBERS: 'equipe-members',
  // Admin
  ADMIN_USERS: 'admin-users',
  // Notificações
  NOTIFICACOES_LIST: 'notificacoes-list',
  // Calendário (prefixos — chaves completas são dinâmicas: ex: "calendario-month-2025-06")
  CALENDARIO_PREFIX: 'calendario-',
} as const;

// Listeners de invalidação
type InvalidationListener = (keys: string[]) => void;
const listeners: InvalidationListener[] = [];

export function onCacheInvalidation(listener: InvalidationListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notifyListeners(keys: string[]) {
  listeners.forEach(fn => {
    try {
      fn(keys);
    } catch (err) {
      console.error('[LocalCache] Erro no listener:', err);
    }
  });
}

/**
 * Busca dados do cache local.
 * Retorna null se não existir ou estiver expirado.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const entry = await getFromIDB<T>(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Expirado - remover
      await deleteFromIDB(key);
      return null;
    }

    return entry.data;
  } catch (err) {
    console.warn('[LocalCache] Erro ao ler cache:', key, err);
    return null;
  }
}

/**
 * Busca dados do cache local mesmo que expirados (stale).
 * NÃO remove a entrada expirada — permite Stale-While-Revalidate.
 * Retorna null apenas se a entrada não existir.
 */
export async function getStale<T>(key: string): Promise<T | null> {
  try {
    const entry = await getFromIDB<T>(key);
    if (!entry) return null;
    return entry.data;
  } catch (err) {
    console.warn('[LocalCache] Erro ao ler cache stale:', key, err);
    return null;
  }
}

/**
 * Salva dados no cache local com TTL configurável.
 */
export async function setCached<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
    };
    await setToIDB(entry);
  } catch (err) {
    console.warn('[LocalCache] Erro ao salvar cache:', key, err);
  }
}

/**
 * Invalida (remove) uma ou mais chaves do cache.
 * Notifica listeners para que componentes possam reagir.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map(key => deleteFromIDB(key)));
    notifyListeners(keys);
    console.log('[LocalCache] Invalidado:', keys.join(', '));
  } catch (err) {
    console.warn('[LocalCache] Erro ao invalidar cache:', err);
  }
}

/**
 * Invalida todas as chaves que contenham o padrão informado.
 */
export async function invalidateCacheByPattern(pattern: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const keysToDelete = (request.result as string[]).filter(k => k.includes(pattern));
      keysToDelete.forEach(k => store.delete(k));
      if (keysToDelete.length > 0) {
        notifyListeners(keysToDelete);
        console.log('[LocalCache] Invalidado por padrão:', pattern, keysToDelete);
      }
    };
  } catch {
    // Fallback em memória
    const keysToDelete: string[] = [];
    for (const key of memoryFallback.keys()) {
      if (key.includes(pattern)) {
        memoryFallback.delete(key);
        keysToDelete.push(key);
      }
    }
    if (keysToDelete.length > 0) notifyListeners(keysToDelete);
  }
}

/**
 * Limpa todo o cache local.
 */
export async function clearAllCache(): Promise<void> {
  try {
    await clearAllIDB();
    memoryFallback.clear();
    console.log('[LocalCache] Cache completamente limpo');
  } catch (err) {
    console.warn('[LocalCache] Erro ao limpar cache:', err);
  }
}

/**
 * ✅ OTIMIZADO: Estratégia Stale-While-Revalidate simplificada
 * - Retorna cache imediatamente se válido
 * - Revalida em background APENAS se forceRefresh = true
 * - Evita re-renders desnecessários
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    ttl?: number;
    onFresh?: (data: T) => void;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, onFresh, forceRefresh = false } = options;

  // 1. Tentar cache primeiro
  const cached = await getCached<T>(key);
  
  if (cached !== null && !forceRefresh) {
    console.log('[LocalCache] ✅ Cache válido:', key);
    return cached;
  }

  // 2. Cache miss ou forceRefresh - buscar dados frescos
  console.log('[LocalCache] 🔄 Buscando dados frescos:', key);
  const freshData = await fetchFn();
  await setCached(key, freshData, ttl);
  
  if (onFresh) {
    onFresh(freshData);
  }
  
  return freshData;
}

/**
 * Verifica se uma chave existe e está válida no cache.
 */
export async function isCacheValid(key: string): Promise<boolean> {
  const data = await getCached(key);
  return data !== null;
}
