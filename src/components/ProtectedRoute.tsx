import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import { supabase } from '../lib/supabaseClient';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // ✅ PONTO 3: Barreira final - verificar status do perfil
  useEffect(() => {
    if (!loading && user && profile && profile.status === 'pendente') {
      console.log('⚠️ [ProtectedRoute] Usuário pendente detectado - bloqueando acesso');
      supabase.auth.signOut();
      navigate('/login', { replace: true });
    }
  }, [user, loading, profile, navigate]);

  // Redirecionar se a rota é exclusiva de admin e o usuário não é admin
  useEffect(() => {
    if (!loading && user && adminOnly && !isAdmin) {
      navigate('/painel', { replace: true });
    }
  }, [user, loading, adminOnly, isAdmin, navigate]);

  // Exibir loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário após o loading, não renderiza nada (vai redirecionar)
  if (!user) {
    return null;
  }

  // Se é rota admin-only e o usuário não é admin, não renderiza (vai redirecionar)
  if (adminOnly && !isAdmin) {
    return null;
  }

  // Usuário autenticado (e com permissão adequada), renderiza o conteúdo
  return <>{children}</>;
}