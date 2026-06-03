import { memo } from 'react';
import { CalendarEvent } from '../../../services/calendarService';

interface GanttTooltipProps {
  eventTooltip: {
    event: CalendarEvent;
    x: number;
    y: number;
  } | null;
}

const GanttTooltip = memo(({ eventTooltip }: GanttTooltipProps) => {
  if (!eventTooltip) return null;

  const evt = eventTooltip.event;

  const typeLabels: Record<string, string> = {
    meeting: 'Reunião',
    presentation: 'Apresentação',
    review: 'Revisão',
    workshop: 'Workshop',
    training: 'Treinamento',
    brainstorm: 'Brainstorm',
    deadline: 'Prazo',
    task: 'Tarefa',
    project_start: 'Início',
    project_deadline: 'Deadline',
    sprint_end: 'Sprint',
  };

  const weekDayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dateObj = new Date(evt.event_date + 'T00:00:00');
  const weekDay = weekDayNames[dateObj.getDay()];
  const dateLabel = `${weekDay}, ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]}`;

  const isRecurring = evt.recurrence_type && evt.recurrence_type !== 'none';

  const tailwindToHex: Record<string, string> = {
    'bg-red-500': '#ef4444',
    'bg-orange-500': '#f97316',
    'bg-amber-500': '#f59e0b',
    'bg-yellow-500': '#eab308',
    'bg-lime-500': '#84cc16',
    'bg-green-500': '#22c55e',
    'bg-emerald-500': '#10b981',
    'bg-teal-500': '#14b8a6',
    'bg-cyan-500': '#06b6d4',
    'bg-sky-500': '#0ea5e9',
    'bg-blue-500': '#3b82f6',
    'bg-indigo-500': '#6366f1',
    'bg-violet-500': '#8b5cf6',
    'bg-purple-500': '#a855f7',
    'bg-fuchsia-500': '#d946ef',
    'bg-pink-500': '#ec4899',
    'bg-rose-500': '#f43f5e',
  };
  const rawColor = evt.color || '';
  const hexColor = tailwindToHex[rawColor] || (rawColor.startsWith('#') ? rawColor : '#f472b6');
  const dotColor = hexColor === '#6b7280' ? '#f472b6' : hexColor;

  return (
    <div
      className="fixed z-[60] w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-[popoverIn_0.18s_ease-out] pointer-events-none"
      style={{
        left: eventTooltip.x,
        top: eventTooltip.y,
        transform: 'translate(-50%, calc(-100% - 8px))',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-0.5">{dateLabel}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">1 evento agendado</p>
      </div>

      {/* Item */}
      <div className="flex items-start gap-2.5 px-4 py-2.5">
        {/* Barra colorida lateral */}
        <div
          className="w-1 min-h-[36px] self-stretch rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: dotColor }}
        />

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Linha de tipo */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <i className="ri-calendar-event-line text-[10px] text-gray-400 dark:text-gray-500" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
              Evento
            </span>
            {isRecurring && (
              <i className="ri-repeat-line text-[10px] text-teal-500 dark:text-teal-400" />
            )}
          </div>

          {/* Nome em bold */}
          <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate leading-tight">
            {evt.title}
          </p>

          {/* Detalhes: horário, duração, local */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {evt.event_time && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                <i className="ri-time-line text-[9px]" />
                {evt.event_time.slice(0, 5)}
                {evt.duration && (
                  <span className="text-gray-300 dark:text-gray-600 ml-0.5">• {evt.duration}</span>
                )}
              </span>
            )}
            {evt.location && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 truncate max-w-[140px]">
                <i className="ri-map-pin-line text-[9px]" />
                {evt.location}
              </span>
            )}
          </div>
        </div>

        {/* Badge de tipo */}
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0 mt-1 whitespace-nowrap">
          {typeLabels[evt.type] || evt.type || 'Evento'}
        </span>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center flex items-center justify-center gap-1">
          <i className="ri-cursor-line text-[10px]" />
          Clique para ver detalhes
        </p>
      </div>
    </div>
  );
});

GanttTooltip.displayName = 'GanttTooltip';

export default GanttTooltip;