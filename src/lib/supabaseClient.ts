
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key devem estar configurados no arquivo .env');
}

// Limpa tokens corrompidos/expirados antes de inicializar o cliente
const STORAGE_KEY = 'supabase.auth.token';
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    const expiresAt = parsed?.expires_at ?? parsed?.currentSession?.expires_at;
    if (expiresAt && Date.now() / 1000 > expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🧹 [Supabase] Token expirado removido do localStorage');
    }
  }
} catch {
  localStorage.removeItem(STORAGE_KEY);
  console.log('🧹 [Supabase] Token corrompido removido do localStorage');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: STORAGE_KEY,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-web',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Interceptor global para detectar erros de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('✅ [Supabase] Token renovado com sucesso');
  }

  if (event === 'SIGNED_OUT') {
    console.log('🔵 [Supabase] Usuário desconectado');
    localStorage.removeItem(STORAGE_KEY);
  }

  if (event === 'USER_UPDATED') {
    console.log('🔵 [Supabase] Dados do usuário atualizados');
  }
});

// Função auxiliar para verificar se a sessão é válida
export async function checkSessionValidity(): Promise<boolean> {
  try {
    // Verifica se há token salvo antes de chamar a API
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ [Supabase] Erro ao verificar sessão:', error);

      if (
        error.message?.includes('Refresh Token') ||
        error.message?.includes('refresh_token') ||
        error.message?.includes('Invalid') ||
        error.message?.includes('expired')
      ) {
        console.log('🧹 [Supabase] Limpando sessão corrompida...');
        localStorage.removeItem(STORAGE_KEY);
        await supabase.auth.signOut({ scope: 'local' });
      }
      return false;
    }

    return !!session;
  } catch (error) {
    console.error('❌ [Supabase] Erro inesperado ao verificar sessão:', error);
    return false;
  }
}

// Função para fazer requisições com retry automático
export async function supabaseQueryWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 2
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn();

      if (result.error) {
        const errorMessage = result.error.message || '';

        if (
          errorMessage.includes('Refresh Token') ||
          errorMessage.includes('refresh_token') ||
          errorMessage.includes('JWT') ||
          errorMessage.includes('expired')
        ) {
          console.error('❌ [Supabase] Erro de autenticação detectado:', errorMessage);
          localStorage.removeItem(STORAGE_KEY);
          await supabase.auth.signOut({ scope: 'local' });

          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }

          return result;
        }

        if (attempt < maxRetries) {
          console.warn(`⚠️ [Supabase] Tentativa ${attempt + 1} falhou, tentando novamente...`);
          lastError = result.error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }

      return result;
    } catch (error) {
      console.error(`❌ [Supabase] Erro na tentativa ${attempt + 1}:`, error);
      lastError = error;

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  return { data: null, error: lastError };
}
