import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, checkSessionValidity } from '../lib/supabaseClient';
import { clearAllCaches } from '../services/realtimeSyncService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isRecoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<boolean>;
  clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  
  // Controles para evitar loops e processamentos duplicados
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);
  const processingEventRef = useRef(false);
  const lastProcessedUserIdRef = useRef<string | null>(null);

  // Função auxiliar para verificar o role do usuário
  const checkUserRole = async (userId: string, userEmail: string | undefined) => {
    try {
      console.log('🔍 [AuthContext] Verificando role do usuário:', userEmail);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error('❌ [AuthContext] Erro ao buscar perfil:', profileError);
        return false;
      }
      
      if (profileData) {
        const adminStatus = profileData.role === 'admin';
        console.log('✅ [AuthContext] Role encontrado:', profileData.role, '| isAdmin:', adminStatus);
        return adminStatus;
      }
      
      console.warn('⚠️ [AuthContext] Perfil não encontrado para o usuário');
      return false;
    } catch (error) {
      console.error('❌ [AuthContext] Erro inesperado ao verificar role:', error);
      return false;
    }
  };

  // Função para limpar sessão corrompida
  const clearInvalidSession = async () => {
    console.log('🧹 [AuthContext] Limpando sessão inválida...');
    
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    lastProcessedUserIdRef.current = null;
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
      await clearAllCaches();
      localStorage.removeItem('supabase.auth.token');
      console.log('✅ [AuthContext] Sessão limpa com sucesso');
    } catch (error) {
      console.error('❌ [AuthContext] Erro ao limpar sessão local:', error);
    }
  };

  // Função para renovar sessão manualmente
  const refreshSession = async (): Promise<boolean> => {
    try {
      console.log('🔄 [AuthContext] Tentando renovar sessão...');
      
      const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
      
      if (error || !newSession) {
        console.error('❌ [AuthContext] Falha ao renovar sessão:', error);
        await clearInvalidSession();
        return false;
      }
      
      console.log('✅ [AuthContext] Sessão renovada com sucesso');
      setSession(newSession);
      setUser(newSession.user);
      
      const adminStatus = await checkUserRole(newSession.user.id, newSession.user.email);
      setIsAdmin(adminStatus);
      
      return true;
    } catch (error) {
      console.error('❌ [AuthContext] Erro ao renovar sessão:', error);
      await clearInvalidSession();
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let sessionCheckInterval: NodeJS.Timeout | null = null;

    const initAuth = async () => {
      // Evita múltiplas inicializações simultâneas
      if (initializingRef.current || initializedRef.current) {
        console.log('⏭️ [AuthContext] Inicialização já em andamento ou concluída');
        return;
      }

      initializingRef.current = true;
      console.log('🔵 [AuthContext] Iniciando verificação de autenticação...');

      try {
        // ── PKCE flow: URL contém ?code= (link de recuperação de senha) ──
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          console.log('🔑 [AuthContext] Código PKCE detectado na URL — trocando por sessão...');
          try {
            const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (!mounted) return;

            if (exchangeError) {
              console.error('❌ [AuthContext] Erro ao trocar código por sessão:', exchangeError);
              // Limpar URL e deixar continuar para mostrar estado inválido
              window.history.replaceState({}, document.title, window.location.pathname);
            } else if (exchangeData?.session) {
              console.log('✅ [AuthContext] Sessão obtida via PKCE — redirecionando para reset-password');

              // Limpar o ?code= da URL sem recarregar a página
              window.history.replaceState({}, document.title, '/reset-password');

              setSession(exchangeData.session);
              setUser(exchangeData.session.user);
              setIsRecoveryMode(true);
              setLoading(false);
              initializedRef.current = true;
              initializingRef.current = false;
              lastProcessedUserIdRef.current = exchangeData.session.user.id;

              // Redirecionar para reset-password se ainda não estiver lá
              if (!window.location.pathname.includes('reset-password')) {
                const basePath = (window as any).__BASE_PATH__ || '';
                const resetPath = basePath ? `${basePath}/reset-password` : '/reset-password';
                window.location.replace(resetPath);
              }
              return;
            }
          } catch (pkceError) {
            console.error('❌ [AuthContext] Erro inesperado no PKCE flow:', pkceError);
          }
        }

        // 1. Verificar se a sessão é válida
        const isValid = await checkSessionValidity();
        
        if (!mounted) return;
        
        if (!isValid) {
          console.log('⚠️ [AuthContext] Sessão inválida detectada - limpando...');
          await clearInvalidSession();
          setLoading(false);
          initializedRef.current = true;
          return;
        }
        
        // 2. Obter sessão atual
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (sessionError) {
          console.error('❌ [AuthContext] Erro ao obter sessão:', sessionError);
          
          if (sessionError.message?.includes('Refresh Token') || 
              sessionError.message?.includes('refresh_token') ||
              sessionError.message?.includes('JWT') ||
              sessionError.message?.includes('expired')) {
            console.log('🧹 [AuthContext] Token inválido detectado - limpando sessão');
            await clearInvalidSession();
          }
          
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          initializedRef.current = true;
          return;
        }

        console.log('🔵 [AuthContext] Sessão obtida:', initialSession ? `Usuário: ${initialSession.user.email}` : 'Sem sessão');

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        // 3. Verificar admin se houver usuário
        if (initialSession?.user) {
          lastProcessedUserIdRef.current = initialSession.user.id;
          const adminStatus = await checkUserRole(initialSession.user.id, initialSession.user.email);
          if (mounted) {
            setIsAdmin(adminStatus);
          }
        } else {
          console.log('🔵 [AuthContext] Sem usuário logado');
          if (mounted) {
            setIsAdmin(false);
            lastProcessedUserIdRef.current = null;
          }
        }
        
        // 4. Configurar verificação periódica da sessão (a cada 5 minutos)
        sessionCheckInterval = setInterval(async () => {
          const isStillValid = await checkSessionValidity();
          
          if (!isStillValid && mounted) {
            console.log('⚠️ [AuthContext] Sessão expirou - limpando...');
            await clearInvalidSession();
            
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return;
          }

          // Verificar se o perfil do usuário ainda existe (proteção contra exclusão)
          if (session?.user?.id) {
            const { data: profileExists, error: profileCheckError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profileCheckError && !profileExists && mounted) {
              console.log('⚠️ [AuthContext] Perfil do usuário foi excluído - forçando logout...');
              await clearInvalidSession();
              
              // Redirecionar para login com mensagem
              localStorage.setItem('account_deleted_message', 'true');
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
            }
          }
        }, 5 * 60 * 1000);
        
      } catch (error) {
        console.error('❌ [AuthContext] Erro ao inicializar autenticação:', error);
        if (mounted) {
          await clearInvalidSession();
        }
      } finally {
        if (mounted) {
          console.log('✅ [AuthContext] Inicialização concluída - loading = false');
          setLoading(false);
          initializedRef.current = true;
          initializingRef.current = false;
        }
      }
    };

    initAuth();

    // 5. Listener de mudanças - PROCESSA APENAS EVENTOS RELEVANTES
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔵 [AuthContext] Auth event:', event);

        if (!mounted) return;

        // PASSWORD_RECOVERY deve ser processado SEMPRE, mesmo antes da inicialização
        // pois o Supabase dispara esse evento ao processar o hash da URL
        if (event === 'PASSWORD_RECOVERY' && newSession?.user) {
          console.log('🔑 [AuthContext] Evento de recuperação de senha detectado');

          setSession(newSession);
          setUser(newSession.user);
          setIsRecoveryMode(true);
          setLoading(false);
          initializedRef.current = true;
          lastProcessedUserIdRef.current = newSession.user.id;

          // Redirecionar para a página de redefinição de senha
          if (!window.location.pathname.includes('reset-password')) {
            const basePath = (window as any).__BASE_PATH__ || '';
            const resetPath = basePath ? `${basePath}/reset-password` : '/reset-password';
            window.location.replace(resetPath);
          }
          return;
        }

        if (!initializedRef.current) {
          console.log('⏭️ [AuthContext] Ignorando evento - não inicializado ainda');
          return;
        }

        // Evita processar múltiplos eventos simultaneamente
        if (processingEventRef.current) {
          console.log('⏭️ [AuthContext] Ignorando evento - já processando outro evento');
          return;
        }

        // TOKEN_REFRESHED com erro
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          console.log('🧹 [AuthContext] Falha ao renovar token - limpando sessão');
          await clearInvalidSession();
          
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return;
        }

        // ✅ PONTO 2: SIGNED_IN - verificar status antes de processar login
        if (event === 'SIGNED_IN' && newSession?.user) {
          // Evita processar o mesmo usuário múltiplas vezes
          if (lastProcessedUserIdRef.current === newSession.user.id) {
            console.log('⏭️ [AuthContext] Usuário já processado, ignorando evento duplicado');
            return;
          }
          
          processingEventRef.current = true;
          console.log('✅ [AuthContext] Processando login do usuário:', newSession.user.email);
          
          // Verificar status do perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', newSession.user.id)
            .maybeSingle();

          if (profile?.status === 'pendente') {
            console.log('⚠️ [AuthContext] Usuário pendente detectado no SIGNED_IN - bloqueando');
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setIsAdmin(false);
            processingEventRef.current = false;
            return;
          }

          // Continuar com o fluxo normal (só se ativo)
          lastProcessedUserIdRef.current = newSession.user.id;
          setSession(newSession);
          setUser(newSession.user);
          
          const adminStatus = await checkUserRole(newSession.user.id, newSession.user.email);
          if (mounted) {
            setIsAdmin(adminStatus);
          }
          
          processingEventRef.current = false;
          return;
        }

        // TOKEN_REFRESHED: atualizar sessão silenciosamente
        if (event === 'TOKEN_REFRESHED' && newSession?.user) {
          console.log('🔄 [AuthContext] Token renovado silenciosamente');
          setSession(newSession);
          setUser(newSession.user);
          return;
        }

        // SIGNED_OUT: limpar estado
        if (event === 'SIGNED_OUT') {
          console.log('🔵 [AuthContext] Usuário deslogado');
          if (mounted) {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setIsRecoveryMode(false);
            lastProcessedUserIdRef.current = null;
            await clearAllCaches();
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('🔐 [AuthContext] Tentando fazer login...');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error('❌ [AuthContext] Erro no login:', error);
      return { error };
    }

    // Verificar status do usuário
    if (data.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('❌ [AuthContext] Erro ao verificar status:', profileError);
        await supabase.auth.signOut();
        return { error: { message: 'Erro ao verificar status da conta', name: 'StatusCheckError', status: 500 } as AuthError };
      }

      if (profileData?.status === 'pendente') {
        console.log('⚠️ [AuthContext] Usuário com status pendente tentou logar');
        await supabase.auth.signOut();
        return { error: { message: 'Sua conta ainda está aguardando aprovação do administrador.', name: 'PendingApprovalError', status: 403 } as AuthError };
      }

      if (profileData?.status === 'inativo') {
        console.log('⚠️ [AuthContext] Usuário inativo tentou logar');
        await supabase.auth.signOut();
        return { error: { message: 'Sua conta foi desativada. Entre em contato com o administrador.', name: 'InactiveAccountError', status: 403 } as AuthError };
      }
    }
    
    console.log('✅ [AuthContext] Login bem-sucedido');
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) return { error };

    if (data.user) {
      // Upsert garante que mesmo se o trigger já criou o perfil,
      // o status será forçado para 'pendente' e cargo ficará em branco
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        nome: fullName,
        role: 'member',
        status: 'pendente',
        cargo: null,
        departamento: null,
        localizacao: null,
      }, { onConflict: 'id' });

      // Criar notificação para admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.id,
          type: 'user_approval',
          title: 'Novo usuário aguardando aprovação',
          message: `${fullName} (${email}) criou uma conta e aguarda aprovação.`,
          read: false
        }));

        await supabase.from('notifications').insert(notifications);
      }
    }

    return { error };
  };

  const signOut = async () => {
    console.log('🔵 [AuthContext] Iniciando logout...');
    
    // Limpa estado local IMEDIATAMENTE
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setLoading(false);
    lastProcessedUserIdRef.current = null;
    processingEventRef.current = false;
    
    await clearAllCaches();
    
    try {
      await supabase.auth.signOut();
      console.log('✅ [AuthContext] Logout concluído');
    } catch (error) {
      console.error('❌ [AuthContext] Erro ao desconectar do Supabase:', error);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { error };
  };

  const clearRecoveryMode = () => {
    setIsRecoveryMode(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      isAdmin,
      isRecoveryMode,
      signIn, 
      signUp, 
      signOut, 
      resetPassword,
      refreshSession,
      clearRecoveryMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
