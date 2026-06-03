import { useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { safeFetchMany } from '../../../services/supabaseHelpers';
import { useCachedData } from '../../../hooks/useCachedData';
import { CACHE_KEYS } from '../../../services/localCache';

interface DeadlineItem {
  id: string;
  task: string;
  project: string;
  dueDate: Date;
  dateLabel: string;
  timeLabel: string;
  urgent: boolean;
  status: string;
  priority: string;
}

function formatDateLabel(dueDate: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? 's' : ''} atrasado`;
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  return `${diffDays} dias`;
}

function isUrgent(dueDate: Date): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= 1;
}

function isOverdue(dueDate: Date): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return target.getTime() < today.getTime();
}

export default function DeadlinesWidget() {
  const { user } = useAuth();

  const fetchFn = useCallback(async (): Promise<DeadlineItem[]> => {
    if (!user) return [];

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 14);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const tasks = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, project_id, due_date, status, priority')
        .or(`user_id.eq.${user.id},responsavel_id.eq.${user.id}`)
        .not('status', 'eq', 'concluida')
        .not('due_date', 'is', null)
        .gte('due_date', todayStr)
        .lte('due_date', futureDateStr)
        .order('due_date', { ascending: true })
        .limit(10)
    );

    if (tasks.length === 0) return [];

    const projectIds = Array.from(
      new Set(tasks.filter((t: any) => t.project_id).map((t: any) => t.project_id as string))
    );

    let projectsMap: Record<string, string> = {};

    if (projectIds.length > 0) {
      const projects = await safeFetchMany(() =>
        supabase
          .from('projects')
          .select('id, nome')
          .in('id', projectIds)
      );

      projectsMap = projects.reduce((acc: Record<string, string>, p: any) => {
        acc[p.id] = p.nome;
        return acc;
      }, {});
    }

    return tasks.map((t: any) => {
      const dueDate = new Date(`${t.due_date}T23:59:59`);
      return {
        id: t.id,
        task: t.title,
        project: t.project_id ? (projectsMap[t.project_id] || 'Sem projeto') : 'Sem projeto',
        dueDate,
        dateLabel: formatDateLabel(dueDate),
        timeLabel: dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        urgent: isUrgent(dueDate),
        status: t.status ?? '',
        priority: t.priority ?? '',
      };
    });
  }, [user]);

  const { data, loading } = useCachedData<DeadlineItem[]>(
    `${CACHE_KEYS.PAINEL_DEADLINES}-${user?.id ?? 'anon'}`,
    fetchFn,
    { enabled: !!user }
  );

  const deadlines = data ?? [];
  const urgentCount = deadlines.filter(d => d.urgent).length;
  const overdueCount = deadlines.filter(d => isOverdue(d.dueDate)).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-700">
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Prazos Próximos
          </h2>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {overdueCount > 0 && (
              <span className="bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                {overdueCount} atraso{overdueCount > 1 ? 's' : ''}
              </span>
            )}
            {urgentCount > 0 && (
              <span className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse p-3 sm:p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : deadlines.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 bg-teal-50 dark:bg-teal-950/30 rounded-full">
              <i className="ri-calendar-check-line text-teal-500 text-xl"></i>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              Nenhum prazo próximo
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Suas tarefas estão em dia!
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {deadlines.map(deadline => {
              const overdue = isOverdue(deadline.dueDate);
              const containerClasses = overdue
                ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-500 dark:border-orange-500 hover:bg-orange-100 dark:hover:bg-orange-950/30'
                : deadline.urgent
                ? 'bg-red-50 dark:bg-red-950/20 border-red-500 dark:border-red-500 hover:bg-red-100 dark:hover:bg-red-950/30'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700';

              return (
                <div
                  key={deadline.id}
                  className={`p-3 sm:p-4 rounded-lg border-l-4 transition-all cursor-pointer group ${containerClasses}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm pr-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {deadline.task}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {deadline.priority === 'alta' && (
                        <span className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-arrow-up-line text-red-500 dark:text-red-400 text-sm"></i>
                        </span>
                      )}
                      {(overdue || deadline.urgent) && (
                        <span className="w-5 h-5 flex items-center justify-center">
                          <i
                            className={`ri-alarm-warning-fill text-base sm:text-lg ${
                              overdue ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400'
                            }`}
                          ></i>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{deadline.project}</p>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                    <div className={`flex items-center gap-1 ${overdue ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      <i className="ri-calendar-line"></i>
                      <span className="font-medium">{deadline.dateLabel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <i className="ri-time-line"></i>
                      <span className="font-medium">{deadline.timeLabel}</span>
                    </div>
                    {deadline.priority && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          deadline.priority === 'alta'
                            ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                            : deadline.priority === 'media'
                            ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400'
                            : 'bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400'
                        }`}
                      >
                        {deadline.priority === 'alta'
                          ? 'Alta'
                          : deadline.priority === 'media'
                          ? 'Média'
                          : 'Baixa'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
