import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import StatsCards from './components/StatsCards';
import UserTable from './components/UserTable';
import { sendEmail, emailTemplates } from '../../services/emailService';

interface UserProfile {
  id: string;
  nome: string | null;
  email: string | null;
  cargo: string | null;
  telefone: string | null;
  role: string;
  status: string;
  created_at: string | null;
  avatar_url: string | null;
  aniversario: string | null;
}

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');

  // Estado único e autoritativo dos usuários — sem cache interferindo
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/painel', { replace: true });
    }
  }, [isAdmin, authLoading, navigate]);

  // -------------------------------------------------------------------------
  // Fetch users — roda UMA vez após auth confirmar que é admin
  // -------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, email, cargo, telefone, role, status, created_at, avatar_url, aniversario')
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      let emailMap = new Map<string, string>();

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
          const res = await fetch(
            'https://bomjvzfvsascqnxsspdb.supabase.co/functions/v1/get-users-emails',
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.users)) {
              json.users.forEach((u: { id: string; email: string | null }) => {
                if (u.id && u.email) emailMap.set(u.id, u.email.trim());
              });
            }
          }
        }
      } catch {
        // sem emails da auth — usa apenas profile
      }

      const result = (profilesData ?? []).map((profile) => {
        const authEmail = emailMap.get(profile.id);
        const profileEmail = profile.email?.trim();
        return {
          ...profile,
          email: authEmail || (profileEmail && profileEmail !== '' ? profileEmail : null),
        };
      });

      setUsers(result);
    } catch (err) {
      console.error('[AdminPage] Erro ao buscar usuários:', err);
      showToast('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin && !hasFetched.current) {
      hasFetched.current = true;
      fetchUsers();
    }
  }, [authLoading, isAdmin, fetchUsers]);

  // -------------------------------------------------------------------------
  // Toast helper
  // -------------------------------------------------------------------------
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // -------------------------------------------------------------------------
  // Change a user's role — atualiza APENAS o estado local, sem re-fetch
  // -------------------------------------------------------------------------
  const handleChangeRole = async (userId: string, newRole: string) => {
    const previousRole = users.find(u => u.id === userId)?.role ?? '';

    // Optimistic update imediato
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      const userName = users.find(u => u.id === userId)?.nome || 'Usuário';
      const roleLabel: Record<string, string> = { admin: 'Admin', member: 'Membro' };
      showToast(`${userName} agora é ${roleLabel[newRole] || newRole}`, 'success');
    } catch (err) {
      // Reverte em caso de erro
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: previousRole } : u));
      console.error('Erro ao alterar papel:', err);
      showToast('Erro ao alterar papel do usuário', 'error');
    }
  };

  // -------------------------------------------------------------------------
  // Change a user's status — atualiza APENAS o estado local, sem re-fetch
  // -------------------------------------------------------------------------
  const handleChangeStatus = async (userId: string, newStatus: string) => {
    const previousStatus = users.find(u => u.id === userId)?.status ?? '';

    // Optimistic update imediato
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      if (newStatus === 'ativo') {
        // Confirmar email automaticamente via Edge Function
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            await fetch(
              'https://bomjvzfvsascqnxsspdb.supabase.co/functions/v1/confirm-user-email',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
              }
            );
          }
        } catch (emailErr) {
          console.warn('[AdminPage] Aviso: não foi possível confirmar email automaticamente:', emailErr);
        }

        // Notificação interna
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'account_approved',
          title: 'Conta aprovada!',
          message: 'Sua conta foi aprovada pelo administrador. Você já pode acessar o sistema.',
          read: false,
        });

        // Enviar email de aprovação
        const approvedUser = users.find(u => u.id === userId);
        if (approvedUser?.email && approvedUser?.nome) {
          const loginUrl = `${window.location.origin}/login`;
          const emailHtml = emailTemplates.userApproved(approvedUser.nome, loginUrl);
          
          sendEmail(
            approvedUser.email,
            'Sua conta foi aprovada! - TaskFlow',
            emailHtml
          ).catch(err => {
            console.error('Erro ao enviar email de aprovação:', err);
          });
        }
      }

      const userName = users.find(u => u.id === userId)?.nome || 'Usuário';
      const statusLabel: Record<string, string> = {
        ativo: 'aprovado',
        inativo: 'suspenso',
        pendente: 'pendente',
      };
      showToast(`${userName} foi ${statusLabel[newStatus] || newStatus}`, 'success');
    } catch (err) {
      // Reverte em caso de erro
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: previousStatus } : u));
      console.error('Erro ao alterar status:', err);
      showToast('Erro ao alterar status do usuário', 'error');
    }
  };

  // -------------------------------------------------------------------------
  // Delete a user
  // -------------------------------------------------------------------------
  const handleDeleteUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    try {
      // 1. Deletar registros relacionados nas tabelas
      await supabase.from('task_comments').delete().eq('user_id', userId);
      await supabase.from('notifications').delete().eq('user_id', userId);
      await supabase.from('notifications').delete().eq('actor_id', userId);
      await supabase.from('files').delete().eq('user_id', userId);
      await supabase.from('calendar_events').delete().eq('user_id', userId);
      await supabase.from('project_members').delete().eq('profile_id', userId);
      await supabase.from('project_activity_log').delete().eq('user_id', userId);
      await supabase.from('tasks').delete().eq('user_id', userId);
      await supabase.from('tasks').delete().eq('responsavel_id', userId);
      await supabase.from('task_subtasks').delete().eq('responsavel_id', userId);

      // 2. Deletar o perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        throw new Error(`Erro ao deletar perfil: ${profileError.message}`);
      }

      // 3. Chamar Edge Function para deletar do Supabase Auth
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/delete-user-auth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erro ao deletar do Auth:', errorData);

        // Perfil já foi deletado, mas Auth falhou
        showToast(
          'Perfil removido, mas a conta de autenticação precisa ser removida manualmente no painel do Supabase',
          'error'
        );
      } else {
        showToast(
          `${targetUser?.nome || 'Usuário'} foi excluído com sucesso`,
          'success'
        );
      }

      // 4. Remover do estado local
      setUsers((prev) => prev.filter((u) => u.id !== userId));

    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      showToast(
        `Erro ao excluir usuário: ${error.message}`,
        'error'
      );
    }
  };

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------
  const filteredByRole = users.filter(u => {
    if (filterRole === 'all') return true;
    if (filterRole === 'pendente') return u.status === 'pendente';
    return u.role === filterRole;
  });

  const pendingCount = users.filter(u => u.status === 'pendente').length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-w-0 max-w-full">
      {/* Page Header */}
      <div className="mb-4">
        <h1
          className="text-2xl font-semibold text-gray-900 dark:text-white mb-1"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Administração
        </h1>
        <p
          className="text-sm text-gray-500 dark:text-gray-400"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Gerencie usuários e configurações do sistema
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <StatsCards users={users} />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm"></i>
          <input
            type="text"
            placeholder="Buscar por nome, email, cargo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'admin', 'member', 'pendente'].map(role => {
            const labels: Record<string, string> = {
              all: 'Todos',
              admin: 'Admins',
              member: 'Membros',
              pendente: `Pendentes${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
            };
            const isActive = filterRole === role;
            return (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap relative ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {labels[role]}
                {role === 'pendente' && pendingCount > 0 && !isActive && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Users Table */}
      <UserTable
        users={filteredByRole}
        currentUserId={user?.id || ''}
        onChangeRole={handleChangeRole}
        onChangeStatus={handleChangeStatus}
        onDeleteUser={handleDeleteUser}
        loading={loading}
        searchQuery={searchQuery}
      />

      {/* Role Legend */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3
          className="text-sm font-semibold text-gray-900 dark:text-white mb-3"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Descrição dos Papéis e Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30 flex-shrink-0 mt-0.5">
              <i className="ri-shield-star-fill text-sm text-purple-600 dark:text-purple-400"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Admin</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Possui todas as permissões de Membro e, além disso, pode gerenciar usuários, alterar papéis e acessar a área de Administração.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30 flex-shrink-0 mt-0.5">
              <i className="ri-user-star-fill text-sm text-teal-600 dark:text-teal-400"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Membro</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Pode criar, editar e excluir Projetos, Sprints, Tarefas e Eventos. Não tem acesso à área de Administração.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Status da Conta:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 flex items-center justify-center rounded bg-green-100 dark:bg-green-900/30 flex-shrink-0 mt-0.5">
                <i className="ri-checkbox-circle-line text-xs text-green-600 dark:text-green-400"></i>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Ativo</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pode acessar o sistema normalmente</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 flex items-center justify-center rounded bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 mt-0.5">
                <i className="ri-time-line text-xs text-amber-600 dark:text-amber-400"></i>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Pendente</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Aguardando aprovação do admin</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 flex items-center justify-center rounded bg-red-100 dark:bg-red-900/30 flex-shrink-0 mt-0.5">
                <i className="ri-close-circle-line text-xs text-red-600 dark:text-red-400"></i>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">Inativo</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Conta suspensa, sem acesso</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-lg border transition-all ${
            toast.type === 'success'
              ? 'bg-white dark:bg-gray-800 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400'
              : 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-lg`}></i>
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 cursor-pointer opacity-60 hover:opacity-100">
            <i className="ri-close-line text-base"></i>
          </button>
        </div>
      )}
    </div>
  );
}
