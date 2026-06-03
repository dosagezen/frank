
import { useState, useRef, useEffect, useCallback } from 'react';
import { CalendarItem } from '../../../services/calendarIntegrationService';

const sourceIcons: Record<string, string> = {
  event: 'ri-calendar-event-line',
  task: 'ri-task-line',
  project: 'ri-folder-line',
  sprint: 'ri-speed-line',
};

const sourceLabels: Record<string, string> = {
  event: 'Evento',
  task: 'Tarefa',
  project: 'Projeto',
  sprint: 'Sprint',
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
  project_start: 'Início',
  project_deadline: 'Deadline',
  sprint_end: 'Sprint',
};

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

function getDotColor(item: CalendarItem): string {
  if (item.source === 'task') return 'bg-sky-500';
  if (item.source === 'project') return item.type === 'project_deadline' ? 'bg-red-500' : 'bg-indigo-500';
  if (item.source === 'sprint') return 'bg-violet-500';
  return item.color || 'bg-teal-500';
}

function getStatusIcon(item: CalendarItem): string | null {
  if (!item.meta?.status) return null;
  const s = item.meta.status.toLowerCase();
  if (s === 'concluida' || s === 'concluido' || s === 'completed' || s === 'done') return 'ri-check-line text-emerald-500';
  if (s === 'em_andamento' || s === 'in_progress' || s === 'em andamento') return 'ri-loader-4-line text-amber-500';
  if (s === 'pendente' || s === 'todo' || s === 'a_fazer') return 'ri-time-line text-gray-400';
  return null;
}

interface CellPreviewPopoverProps {
  items: CalendarItem[];
  day: number;
  month: number;
  year: number;
  cellRef: HTMLElement | null;
  onClose: () => void;
  onItemClick: (item: CalendarItem) => void;
}

export default function CellPreviewPopover({
  items,
  day,
  month,
  year,
  cellRef,
  onClose,
  onItemClick,
}: CellPreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'bottom' | 'top' | 'right' | 'left' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });

  const calculatePosition = useCallback(() => {
    if (!cellRef || !popoverRef.current) return;

    const cellRect = cellRef.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const gap = 8;

    let top = 0;
    let left = 0;
    let placement: 'bottom' | 'top' | 'right' | 'left' = 'bottom';

    // Prefer bottom
    if (cellRect.bottom + gap + popoverRect.height < viewportH) {
      top = cellRect.bottom + gap;
      left = cellRect.left + cellRect.width / 2 - popoverRect.width / 2;
      placement = 'bottom';
    }
    // Try top
    else if (cellRect.top - gap - popoverRect.height > 0) {
      top = cellRect.top - gap - popoverRect.height;
      left = cellRect.left + cellRect.width / 2 - popoverRect.width / 2;
      placement = 'top';
    }
    // Try right
    else if (cellRect.right + gap + popoverRect.width < viewportW) {
      top = cellRect.top + cellRect.height / 2 - popoverRect.height / 2;
      left = cellRect.right + gap;
      placement = 'right';
    }
    // Fallback left
    else {
      top = cellRect.top + cellRect.height / 2 - popoverRect.height / 2;
      left = cellRect.left - gap - popoverRect.width;
      placement = 'left';
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, viewportW - popoverRect.width - 8));
    top = Math.max(8, Math.min(top, viewportH - popoverRect.height - 8));

    setPosition({ top, left, placement });
  }, [cellRef]);

  useEffect(() => {
    calculatePosition();
    const timer = requestAnimationFrame(calculatePosition);
    return () => cancelAnimationFrame(timer);
  }, [calculatePosition, items]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        cellRef &&
        !cellRef.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, cellRef]);

  const weekDayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const dateObj = new Date(year, month, day);
  const weekDay = weekDayNames[dateObj.getDay()];
  const dateLabel = `${weekDay}, ${day} de ${monthNames[month]}`;

  const maxVisible = 5;
  const visibleItems = items.slice(0, maxVisible);
  const remaining = items.length - maxVisible;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[55] w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-[popoverIn_0.18s_ease-out]"
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 mb-0.5">{dateLabel}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {items.length} {items.length === 1 ? 'item' : 'itens'} agendado{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Items list */}
      <div className="py-1.5 max-h-[260px] overflow-y-auto">
        {visibleItems.map((item) => {
          const statusIcon = getStatusIcon(item);
          const isRecurrent = !!(item.recurrence_parent_id || (item.recurrence_type && item.recurrence_type !== 'none'));

          return (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onItemClick(item);
                onClose();
              }}
              className="w-full flex items-start gap-2.5 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer text-left group"
            >
              {/* Color bar */}
              <div className={`w-1 min-h-[32px] self-stretch ${getDotColor(item)} rounded-full flex-shrink-0 mt-0.5`}></div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <i className={`${sourceIcons[item.source]} text-[10px] text-gray-400 dark:text-gray-500`}></i>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                    {sourceLabels[item.source]}
                  </span>
                  {isRecurrent && (
                    <i className="ri-repeat-line text-[10px] text-teal-500 dark:text-teal-400"></i>
                  )}
                  {statusIcon && (
                    <i className={`${statusIcon} text-[10px]`}></i>
                  )}
                </div>
                <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate leading-tight group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.source === 'event' && item.event_time && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                      <i className="ri-time-line text-[9px]"></i>
                      {formatTime(item.event_time)}
                      {item.duration && <span className="text-gray-300 dark:text-gray-600">• {item.duration}</span>}
                    </span>
                  )}
                  {item.meta?.projectName && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5 truncate max-w-[120px]">
                      <i className="ri-folder-line text-[9px]"></i>
                      {item.meta.projectName}
                    </span>
                  )}
                  {item.meta?.priority && (
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                      item.meta.priority === 'alta' || item.meta.priority === 'urgente'
                        ? 'text-red-500'
                        : item.meta.priority === 'media'
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}>
                      {item.meta.priority}
                    </span>
                  )}
                  {item.meta?.progress !== undefined && item.meta.progress !== null && (
                    <div className="flex items-center gap-1">
                      <div className="w-10 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.meta.progress >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                          style={{ width: `${Math.min(item.meta.progress, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500">{item.meta.progress}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Type badge */}
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0 mt-1">
                {typeLabels[item.type] || item.type}
              </span>
            </button>
          );
        })}

        {remaining > 0 && (
          <div className="px-4 py-2 text-center">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
              +{remaining} {remaining === 1 ? 'item' : 'itens'} a mais
            </span>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center flex items-center justify-center gap-1">
          <i className="ri-cursor-line text-[10px]"></i>
          Clique em um item para ver detalhes
        </p>
      </div>
    </div>
  );
}
