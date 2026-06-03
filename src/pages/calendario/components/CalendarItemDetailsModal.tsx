
import { CalendarItem } from '../../../services/calendarIntegrationService';

interface ItemDetailsModalProps {
  item: CalendarItem;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

const sourceLabels: Record<string, string> = {
  event: 'Evento',
  task: 'Tarefa',
  project: 'Projeto',
  sprint: 'Sprint',
};

const sourceIcons: Record<string, string> = {
  event: 'ri-calendar-event-line',
  task: 'ri-task-line',
  project: 'ri-folder-line',
  sprint: 'ri-speed-line',
};

const typeLabels: Record<string, string> = {
  meeting: 'Reunião',
  presentation: 'Apresentação',
  review: 'Revisão',
  workshop: 'Workshop',
  training: 'Treinamento',
  brainstorm: 'Brainstorm',
  deadline: 'Prazo',
  task: 'Tarefa',
  project_start: 'Início do Projeto',
  project_deadline: 'Deadline do Projeto',
  sprint_end: 'Fim da Sprint',
};

const statusLabels: Record<string, string> = {
  todo: 'A Fazer',
  'em-andamento': 'Em Andamento',
  'em-revisao': 'Em Revisão',
  concluida: 'Concluída',
  'em-progresso': 'Em Progresso',
  concluido: 'Concluído',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
  ativo: 'Ativo',
  planejamento: 'Planejamento',
  finalizado: 'Finalizado',
  active: 'Ativo',
  completed: 'Concluído',
};

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  'em-andamento': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'em-revisao': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'em-progresso': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  concluido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pausado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ativo: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  planejamento: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  finalizado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  active: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const priorityLabels: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  urgente: 'Urgente',
  critica: 'Crítica',
};

const priorityColors: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  baixa: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  urgente: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  critica: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const sourceColorMap: Record<string, { bg: string; text: string; light: string }> = {
  event: { bg: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400', light: 'bg-teal-50 dark:bg-teal-900/20' },
  task: { bg: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', light: 'bg-sky-50 dark:bg-sky-900/20' },
  project: { bg: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', light: 'bg-indigo-50 dark:bg-indigo-900/20' },
  sprint: { bg: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400', light: 'bg-violet-50 dark:bg-violet-900/20' },
};

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr + 'T12:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const formatted = date.toLocaleDateString('pt-BR', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function CalendarItemDetailsModal({
  item,
  isOpen,
  onClose,
  onNavigate,
}: ItemDetailsModalProps) {
  const colors = sourceColorMap[item.source] || sourceColorMap.event;
  const icon = sourceIcons[item.source] || 'ri-calendar-event-line';

  if (!isOpen) return null;

  const dateTypeLabel = item.meta?.dateType === 'start'
    ? 'Data Início'
    : item.meta?.dateType === 'deadline'
    ? 'Deadline'
    : item.meta?.dateType === 'sprint_end'
    ? 'Fim da Sprint'
    : item.meta?.dateType === 'due_date'
    ? 'Data Entrega'
    : 'Data';

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className={`absolute top-0 left-0 right-0 h-1 ${colors.bg}`}></div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-11 h-11 flex items-center justify-center rounded-xl ${colors.light} flex-shrink-0`}>
                <i className={`${icon} text-xl ${colors.text}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1.5 break-words leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {item.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.light} ${colors.text}`}>
                    <i className={`${icon} text-[10px]`}></i>
                    {sourceLabels[item.source]}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {typeLabels[item.type] || item.type}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all cursor-pointer flex-shrink-0"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="space-y-4">
            {/* Date & Time */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0">
                    <i className="ri-calendar-line text-lg text-gray-600 dark:text-gray-300"></i>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{dateTypeLabel}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatFullDate(item.event_date)}
                    </p>
                  </div>
                </div>
                {item.source === 'event' && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg shadow-sm flex-shrink-0">
                      <i className="ri-time-line text-lg text-gray-600 dark:text-gray-300"></i>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Horário</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatTime(item.event_time)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status & Priority (for tasks/projects) */}
            {(item.meta?.status || item.meta?.priority) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {item.meta?.status && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-flag-line"></i> Status
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[item.meta.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {statusLabels[item.meta.status] || item.meta.status}
                    </span>
                  </div>
                )}
                {item.meta?.priority && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-arrow-up-circle-line"></i> Prioridade
                    </p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColors[item.meta.priority] || 'bg-gray-100 text-gray-600'}`}>
                      {priorityLabels[item.meta.priority] || item.meta.priority}
                    </span>
                  </div>
                )}
                {item.meta?.progress !== undefined && item.meta.progress !== null && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <i className="ri-pie-chart-line"></i> Progresso
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.meta.progress >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                          style={{ width: `${Math.min(item.meta.progress, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.meta.progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Project info */}
            {item.meta?.projectName && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <i className="ri-folder-line"></i> Projeto
                </p>
                <div className="flex items-center gap-2">
                  {item.meta.projectColor && (
                    <div className={`w-3 h-3 rounded-full ${item.meta.projectColor}`}></div>
                  )}
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.meta.projectName}</p>
                </div>
              </div>
            )}

            {/* Sprint info */}
            {item.meta?.sprintName && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <i className="ri-speed-line"></i> Sprint
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.meta.sprintName}</p>
              </div>
            )}

            {/* Assignee */}
            {item.meta?.assignee && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <i className="ri-user-line"></i> Responsável
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.meta.assignee}</p>
              </div>
            )}

            {/* Tags */}
            {item.meta?.tags && item.meta.tags.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <i className="ri-price-tag-3-line"></i> Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.meta.tags.map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {item.description && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <i className={`ri-file-text-line ${colors.text}`}></i>
                  Descrição
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {item.description}
                  </p>
                </div>
              </div>
            )}

            {/* Attendees (for events) */}
            {item.source === 'event' && item.attendees && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <i className={`ri-group-line ${colors.text}`}></i>
                  Participantes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.attendees.split(',').map((name, idx) => (
                    <div key={idx} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full ${colors.light} flex-shrink-0`}>
                        <span className={`text-xs font-bold ${colors.text}`}>
                          {name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{name.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Read-only notice */}
            {item.isReadOnly && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                <i className="ri-information-line text-amber-600 dark:text-amber-400"></i>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Este item vem da seção de {sourceLabels[item.source]?.toLowerCase()}s. Para editá-lo, acesse a página correspondente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <div>
            {item.isReadOnly && item.source === 'task' && onNavigate && (
              <button
                onClick={() => onNavigate('/tarefas')}
                className={`px-4 py-2.5 ${colors.text} hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2`}
              >
                <i className="ri-external-link-line"></i>
                Ver Tarefas
              </button>
            )}
            {item.isReadOnly && item.source === 'project' && onNavigate && (
              <button
                onClick={() => onNavigate('/projetos')}
                className={`px-4 py-2.5 ${colors.text} hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors font-medium text-sm whitespace-nowrap cursor-pointer flex items-center gap-2`}
              >
                <i className="ri-external-link-line"></i>
                Ver Projetos
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
