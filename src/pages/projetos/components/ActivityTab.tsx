
import { useState, useEffect } from 'react';
import { fetchProjectActivityLog } from '../../../services/activityLogService';
import type { ActivityLog } from '../../../services/activityLogService';

interface ActivityTabProps {
  projectId: string;
}

const ACTION_CONFIG: Record<
  string,
  { icon: string; color: string; bgColor: string }
> = {
  created: {
    icon: 'ri-add-circle-line',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  updated: {
    icon: 'ri-edit-line',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
  },
  member_added: {
    icon: 'ri-user-add-line',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  member_removed: {
    icon: 'ri-user-unfollow-line',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  sprint_added: {
    icon: 'ri-flashlight-line',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  sprint_removed: {
    icon: 'ri-delete-bin-line',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  entregavel_added: {
    icon: 'ri-price-tag-3-line',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  entregavel_removed: {
    icon: 'ri-price-tag-3-line',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  link_added: {
    icon: 'ri-link',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  link_removed: {
    icon: 'ri-link-unlink',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

const DEFAULT_CONFIG = {
  icon: 'ri-information-line',
  color: 'text-gray-600 dark:text-gray-400',
  bgColor: 'bg-gray-100 dark:bg-gray-700',
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000,
  );

  if (diffInSeconds < 60) return 'agora mesmo';
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min atrás`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} atrás`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'dia' : 'dias'} atrás`;
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupByDate(logs: ActivityLog[]): Map<string, ActivityLog[]> {
  const groups = new Map<string, ActivityLog[]>();
  logs.forEach((log) => {
    const date = new Date(log.created_at);
    const key = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const existing = groups.get(key) || [];
    existing.push(log);
    groups.set(key, existing);
  });
  return groups;
}

export default function ActivityTab({ projectId }: ActivityTabProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const logs = await fetchProjectActivityLog(projectId);
        setActivities(logs);
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const filteredActivities = filterType === 'all'
    ? activities
    : activities.filter((a) => {
        if (filterType === 'fields') return a.action_type === 'updated';
        if (filterType === 'members')
          return (
            a.action_type === 'member_added' ||
            a.action_type === 'member_removed'
          );
        if (filterType === 'sprints')
          return (
            a.action_type === 'sprint_added' ||
            a.action_type === 'sprint_removed'
          );
        return true;
      });

  const grouped = groupByDate(filteredActivities);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full">
          <i className="ri-history-line text-3xl text-gray-400 dark:text-gray-500"></i>
        </div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Nenhuma atividade registrada
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          As alterações feitas neste projeto serão registradas
          automaticamente aqui a partir de agora
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
          Filtrar:
        </span>
        {[
          { key: 'all', label: 'Todas', icon: 'ri-list-check-2' },
          { key: 'fields', label: 'Campos', icon: 'ri-edit-line' },
          { key: 'members', label: 'Equipe', icon: 'ri-team-line' },
          { key: 'sprints', label: 'Sprints', icon: 'ri-flashlight-line' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filterType === f.key
                ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <i className={f.icon}></i>
            {f.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {filteredActivities.length}{' '}
          {filteredActivities.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {/* Timeline agrupada por data */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([dateLabel, logs]) => (
          <div key={dateLabel}>
            {/* Data header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {dateLabel}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>

            {/* Logs do dia */}
            <div className="space-y-1 ml-1">
              {logs.map((activity, idx) => {
                const config = ACTION_CONFIG[activity.action_type] || DEFAULT_CONFIG;
                const isLast = idx === logs.length - 1;

                return (
                  <div key={activity.id} className="flex gap-3 relative">
                    {/* Timeline line */}
                    {!isLast && (
                      <div className="absolute left-[17px] top-9 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></div>
                    )}

                    {/* Icon */}
                    <div
                      className={`w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 ${config.bgColor} relative z-10`}
                    >
                      <i className={`${config.icon} text-base ${config.color}`}></i>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {activity.user_nome}
                            </span>{' '}
                            <span className="text-gray-600 dark:text-gray-400">
                              {getActionText(activity)}
                            </span>
                          </p>

                          {/* Detalhes da alteração */}
                          {activity.action_type === 'updated' &&
                            activity.old_value &&
                            activity.new_value && (
                              <div className="mt-1.5 flex items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 line-through max-w-[140px] truncate">
                                  {formatDisplayValue(
                                    activity.field_name,
                                    activity.old_value,
                                  )}
                                </span>
                                <i className="ri-arrow-right-line text-gray-400"></i>
                                <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400 rounded border border-green-200 dark:border-green-800 max-w-[140px] truncate">
                                  {formatDisplayValue(
                                    activity.field_name,
                                    activity.new_value,
                                  )}
                                </span>
                              </div>
                            )}

                          {/* Valores adicionados/removidos */}
                          {(activity.action_type.includes('added') ||
                            activity.action_type.includes('removed')) &&
                            activity.new_value && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {activity.new_value.split(', ').map((val, i) => (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      activity.action_type.includes('added')
                                        ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                        : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                                    }`}
                                  >
                                    {activity.action_type.includes('added')
                                      ? '+'
                                      : '-'}{' '}
                                    {val}
                                  </span>
                                ))}
                              </div>
                            )}
                          {activity.action_type.includes('removed') &&
                            activity.old_value &&
                            !activity.new_value && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {activity.old_value.split(', ').map((val, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                                  >
                                    - {val}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>

                        {/* Timestamp */}
                        <span
                          className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0 mt-0.5"
                          title={formatFullDate(activity.created_at)}
                        >
                          {formatTimeAgo(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getActionText(activity: ActivityLog): string {
  // Remove o nome do usuário da descrição para evitar duplicação
  const desc = activity.description;
  const parts = desc.split(' ');
  // Se a descrição começa com um verbo (Criou, Alterou, Adicionou, Removeu)
  const verbs = ['Criou', 'Alterou', 'Adicionou', 'Removeu'];
  if (verbs.some((v) => parts[0] === v)) {
    return desc.charAt(0).toLowerCase() + desc.slice(1);
  }
  return desc;
}

function formatDisplayValue(
  fieldName: string | null,
  value: string,
): string {
  if (!fieldName) return value;
  if (fieldName === 'status') {
    const map: Record<string, string> = {
      'nao-iniciado': 'Não Iniciado',
      'em-andamento': 'Em Andamento',
      parado: 'Parado',
      concluido: 'Concluído',
    };
    return map[value] || value;
  }
  if (fieldName === 'prioridade') {
    const map: Record<string, string> = {
      baixa: 'Baixa',
      media: 'Média',
      alta: 'Alta',
    };
    return map[value] || value;
  }
  if (fieldName === 'kanban_stage') {
    const map: Record<string, string> = {
      backlog: 'Backlog',
      desafio: 'Desafio',
      persona: 'Persona',
      'proposta-valor': 'Proposta de Valor',
      validacao: 'Validação',
      mvp: 'MVP',
    };
    return map[value] || value;
  }
  if (
    fieldName === 'data_inicio' ||
    fieldName === 'prazo' ||
    fieldName === 'deadline'
  ) {
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return value;
    }
  }
  if (value === '(vazio)') return '(vazio)';
  return value;
}
