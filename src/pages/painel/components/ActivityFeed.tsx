import { useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import { supabase } from '../../../lib/supabaseClient';
import UserAvatar from '../../../components/base/UserAvatar';
import { useCachedData } from '../../../hooks/useCachedData';
import { useProfiles } from '../../../hooks/useProfiles';
import { CACHE_KEYS } from '../../../services/localCache';

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  icon: string;
  color: string;
  type: 'task' | 'project' | 'comment';
  userId?: string;
  avatarUrl?: string | null;
}

export default function ActivityFeed() {
  const { user } = useAuth();
  const { data: profiles } = useProfiles();

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'agora mesmo';
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} min atrás`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hora' : 'horas'} atrás`;
    }
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'dia' : 'dias'} atrás`;
  };

  const parseTimeAgo = (timeString: string): number => {
    if (timeString === 'agora mesmo') return 0;
    const match = timeString.match(/(\d+)/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    if (timeString.includes('min')) return value;
    if (timeString.includes('hora')) return value * 60;
    if (timeString.includes('dia')) return value * 1440;
    return 0;
  };

  const fetchFn = useCallback(async (): Promise<Activity[]> => {
    if (!user || !profiles) return [];

    const profilesMap = new Map(profiles.map((p) => [p.id, p]));
    const profilesByName = new Map(profiles.map((p) => [p.nome, p]));
    const allActivities: Activity[] = [];

    const completedTasks = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, updated_at, responsavel_id')
        .eq('status', 'feito')
        .order('updated_at', { ascending: false })
        .limit(3)
    );

    completedTasks.forEach((task: any) => {
      const profile = profilesMap.get(task.responsavel_id);
      if (profile) {
        allActivities.push({
          id: `task-${task.id}`,
          user: profile.nome,
          userId: task.responsavel_id,
          avatarUrl: profile.avatar_url,
          action: 'concluiu a tarefa',
          target: task.title,
          time: formatTimeAgo(task.updated_at),
          icon: 'ri-check-line',
          color: 'bg-green-500 dark:bg-green-600',
          type: 'task',
        });
      }
    });

    const recentProjects = await safeFetchMany(() =>
      supabase
        .from('projects')
        .select('id, nome, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(2)
    );

    recentProjects.forEach((project: any) => {
      const profile = profilesMap.get(project.user_id);
      if (profile) {
        allActivities.push({
          id: `project-${project.id}`,
          user: profile.nome,
          userId: project.user_id,
          avatarUrl: profile.avatar_url,
          action: 'criou o projeto',
          target: project.nome,
          time: formatTimeAgo(project.created_at),
          icon: 'ri-folder-add-line',
          color: 'bg-orange-500 dark:bg-orange-600',
          type: 'project',
        });
      }
    });

    const recentComments = await safeFetchMany(() =>
      supabase
        .from('task_comments')
        .select('id, data, autor_nome, task_id')
        .order('data', { ascending: false })
        .limit(2)
    );

    if (recentComments.length > 0) {
      const taskIds = recentComments.map((c: any) => c.task_id).filter(Boolean);
      if (taskIds.length > 0) {
        const commentTasks = await safeFetchMany(() =>
          supabase.from('tasks').select('id, title').in('id', taskIds)
        );
        const taskMap = new Map(commentTasks.map((t: any) => [t.id, t]));

        recentComments.forEach((comment: any) => {
          const task = taskMap.get(comment.task_id);
          if (task) {
            const profile = profilesByName.get(comment.autor_nome);
            allActivities.push({
              id: `comment-${comment.id}`,
              type: 'comment',
              user: comment.autor_nome || 'Usuário',
              avatarUrl: profile?.avatar_url || null,
              action: 'comentou na tarefa',
              target: (task as any).title,
              time: formatTimeAgo(comment.data),
              icon: 'ri-chat-3-line',
              color: 'bg-teal-500 dark:bg-teal-600',
            });
          }
        });
      }
    }

    allActivities.sort((a, b) => parseTimeAgo(a.time) - parseTimeAgo(b.time));
    return allActivities.slice(0, 5);
  }, [user, profiles]);

  const { data, loading } = useCachedData<Activity[]>(
    CACHE_KEYS.PAINEL_ACTIVITY,
    fetchFn,
    { enabled: !!user && !!profiles }
  );

  const activities = data ?? [];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Atividades Recentes
          </h2>
        </div>
        <div className="p-8 text-center">
          <i className="ri-history-line text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma atividade recente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Atividades Recentes
        </h2>
      </div>

      <div className="p-4 sm:p-6">
        <div className="space-y-3 sm:space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-2 sm:gap-3 group">
              <div className="flex-shrink-0">
                <UserAvatar
                  avatarUrl={activity.avatarUrl}
                  nome={activity.user}
                  size="md"
                  className="w-7 h-7 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-900 dark:text-gray-200" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <span className="font-semibold text-gray-900 dark:text-white">{activity.user}</span>
                  {' '}{activity.action}{' '}
                  <span className="font-semibold text-teal-600 dark:text-teal-400">{activity.target}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-4 h-4 ${activity.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                    <i className={`${activity.icon} text-white text-xs`}></i>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}