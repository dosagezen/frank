
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import UserAvatar from '../../../components/base/UserAvatar';
import { useCachedData } from '../../../hooks/useCachedData';
import { CACHE_KEYS } from '../../../services/localCache';

interface TeamMember {
  id: string;
  nome: string;
  cargo: string;
  avatar_url: string | null;
  tarefas_ativas: number;
}

export default function TeamWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchFn = useCallback(async (): Promise<TeamMember[]> => {
    if (!user) return [];

    const profiles = await safeFetchMany(() =>
      supabase
        .from('profiles')
        .select('id, nome, cargo, avatar_url')
        .order('nome', { ascending: true })
    );

    if (profiles.length === 0) return [];

    const membersWithTasks = await Promise.all(
      profiles.map(async (profile: any) => {
        try {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('responsavel_id', profile.id)
            .neq('status', 'concluida');
          return { ...profile, tarefas_ativas: count || 0 };
        } catch {
          return { ...profile, tarefas_ativas: 0 };
        }
      })
    );

    return membersWithTasks
      .sort((a, b) => b.tarefas_ativas - a.tarefas_ativas)
      .slice(0, 6);
  }, [user]);

  const { data, loading } = useCachedData<TeamMember[]>(
    CACHE_KEYS.PAINEL_TEAM,
    fetchFn,
    { enabled: !!user }
  );

  const members = data ?? [];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Equipe
          </h2>
        </div>
        <div className="p-8 text-center">
          <i className="ri-team-line text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum membro na equipe ainda</p>
          <button
            onClick={() => navigate('/equipe')}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            Adicionar Membros
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Equipe
          </h2>
          <button
            onClick={() => navigate('/equipe')}
            className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium text-sm whitespace-nowrap cursor-pointer self-start sm:self-auto"
          >
            Ver todos
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="space-y-2 sm:space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer group border border-transparent dark:border-gray-600"
              onClick={() => navigate('/equipe')}
            >
              <div className="relative flex-shrink-0">
                <UserAvatar
                  avatarUrl={member.avatar_url}
                  nome={member.nome}
                  size="lg"
                  className="w-9 h-9 sm:w-10 sm:h-10 group-hover:scale-110 transition-transform"
                />
                <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {member.nome}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{member.cargo}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-gray-900 dark:text-white">{member.tarefas_ativas}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">tarefas</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
