import { useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedData } from '../../../hooks/useCachedData';
import { CACHE_KEYS } from '../../../services/localCache';

interface StatsData {
  tarefasAtivas: number;
  totalProjetos: number;
  membrosEquipe: number;
  prazosProximos: number;
}

export default function StatsOverview() {
  const { user, isAdmin } = useAuth();

  const fetchStats = useCallback(async (): Promise<StatsData> => {
    const [projectsResult, tasksResult, profilesResult, upcomingTasksResult] = await Promise.all([
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .or('privado.is.null,privado.eq.false'),
      isAdmin
        ? supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'feito')
        : supabase.from('tasks').select('id, project_id, user_id, responsavel_id', { count: 'exact' }).neq('status', 'feito'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      isAdmin
        ? supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .neq('status', 'feito')
            .gte('due_date', new Date().toISOString().split('T')[0])
            .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        : supabase
            .from('tasks')
            .select('id, project_id, user_id, responsavel_id', { count: 'exact' })
            .neq('status', 'feito')
            .gte('due_date', new Date().toISOString().split('T')[0])
            .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    ]);

    let tarefasCount = 0;
    let prazosCount = 0;

    if (isAdmin) {
      tarefasCount = tasksResult.count || 0;
      prazosCount = upcomingTasksResult.count || 0;
    } else {
      const [ownProjects, memberProjects] = await Promise.all([
        supabase.from('projects').select('id').eq('user_id', user!.id),
        supabase.from('project_members').select('project_id').eq('profile_id', user!.id),
      ]);

      const accessibleProjectIds = new Set([
        ...(ownProjects.data?.map((p: any) => p.id) || []),
        ...(memberProjects.data?.map((mp: any) => mp.project_id) || []),
      ]);

      const allTasks = (tasksResult.data as any[]) || [];
      tarefasCount = allTasks.filter(
        (t: any) => t.user_id === user!.id || t.responsavel_id === user!.id || (t.project_id && accessibleProjectIds.has(t.project_id))
      ).length;

      const allUpcoming = (upcomingTasksResult.data as any[]) || [];
      prazosCount = allUpcoming.filter(
        (t: any) => t.user_id === user!.id || t.responsavel_id === user!.id || (t.project_id && accessibleProjectIds.has(t.project_id))
      ).length;
    }

    return {
      tarefasAtivas: tarefasCount,
      totalProjetos: projectsResult.count ?? 0,
      membrosEquipe: profilesResult.count ?? 0,
      prazosProximos: prazosCount,
    };
  }, [user, isAdmin]);

  const { data: stats, loading } = useCachedData<StatsData>(
    CACHE_KEYS.PAINEL_STATS,
    fetchStats,
    { ttl: 5 * 60 * 1000, enabled: !!user }
  );

  const statsData = [
    {
      id: 1,
      title: 'Tarefas Ativas',
      value: loading ? '...' : String(stats?.tarefasAtivas ?? 0),
      change: '+12%',
      trend: 'up',
      icon: 'ri-task-line',
      color: 'from-teal-500 to-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
    },
    {
      id: 2,
      title: 'Projetos',
      value: loading ? '...' : String(stats?.totalProjetos ?? 0),
      change: '+3',
      trend: 'up',
      icon: 'ri-folder-line',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
    {
      id: 3,
      title: 'Membros da Equipe',
      value: loading ? '...' : String(stats?.membrosEquipe ?? 0),
      change: '+2',
      trend: 'up',
      icon: 'ri-team-line',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      id: 4,
      title: 'Prazos Próximos',
      value: loading ? '...' : String(stats?.prazosProximos ?? 0),
      change: '-3',
      trend: 'down',
      icon: 'ri-alarm-warning-line',
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      iconColor: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 max-w-full">
      {statsData.map((stat) => (
        <div
          key={stat.id}
          className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl px-3 py-3 shadow-sm hover:shadow-lg dark:shadow-none dark:hover:shadow-teal-500/10 transition-all border border-gray-100 dark:border-gray-700 min-w-0 overflow-hidden group"
        >
          <div className="flex items-start justify-between mb-1.5 gap-2">
            <div className={`w-9 h-9 ${stat.bgColor} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
              <i className={`${stat.icon} text-base ${stat.iconColor}`}></i>
            </div>
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                stat.trend === 'up'
                  ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
              }`}
            >
              {stat.change}
            </span>
          </div>
          <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
            {stat.title}
          </h3>
          <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}