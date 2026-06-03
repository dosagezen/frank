import { useMemo, useCallback } from 'react';
import { CalendarItem } from '../../../services/calendarIntegrationService';
import { DragState } from '../../../hooks/useCalendarDragDrop';
import UserAvatar from '../../../components/base/UserAvatar';

interface DayViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onDeleteEvent: (eventId: string) => void;
  deletingId: string | null;
  dragState: DragState;
  canDrag: (item: CalendarItem) => boolean;
  onDragStart: (e: React.DragEvent, item: CalendarItem) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetDate: string, targetTime?: string) => void;
  onDragEnd: () => void;
}

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

const typeColorBorder: Record<string, string> = {
  meeting: 'border-l-teal-500',
  presentation: 'border-l-amber-500',
  review: 'border-l-emerald-500',
  workshop: 'border-l-orange-500',
  training: 'border-l-cyan-500',
  brainstorm: 'border-l-rose-500',
  deadline: 'border-l-red-500',
  task: 'border-l-sky-500',
  project_start: 'border-l-indigo-500',
  project_deadline: 'border-l-red-500',
  sprint_end: 'border-l-violet-500',
};

const typeColorBg: Record<string, string> = {
  meeting: 'bg-teal-50 dark:bg-teal-900/15',
  presentation: 'bg-amber-50 dark:bg-amber-900/15',
  review: 'bg-emerald-50 dark:bg-emerald-900/15',
  workshop: 'bg-orange-50 dark:bg-orange-900/15',
  training: 'bg-cyan-50 dark:bg-cyan-900/15',
  brainstorm: 'bg-rose-50 dark:bg-rose-900/15',
  deadline: 'bg-red-50 dark:bg-red-900/15',
  task: 'bg-sky-50 dark:bg-sky-900/15',
  project_start: 'bg-indigo-50 dark:bg-indigo-900/15',
  project_deadline: 'bg-red-50 dark:bg-red-900/15',
  sprint_end: 'bg-violet-50 dark:bg-violet-900/15',
};

const typeColorText: Record<string, string> = {
  meeting: 'text-teal-700 dark:text-teal-400',
  presentation: 'text-amber-700 dark:text-amber-400',
  review: 'text-emerald-700 dark:text-emerald-400',
  workshop: 'text-orange-700 dark:text-orange-400',
  training: 'text-cyan-700 dark:text-cyan-400',
  brainstorm: 'text-rose-700 dark:text-rose-400',
  deadline: 'text-red-700 dark:text-red-400',
  task: 'text-sky-700 dark:text-sky-400',
  project_start: 'text-indigo-700 dark:text-indigo-400',
  project_deadline: 'text-red-700 dark:text-red-400',
  sprint_end: 'text-violet-700 dark:text-violet-400',
};

const durationLabels: Record<string, string> = {
  '15min': '15 min',
  '30min': '30 min',
  '45min': '45 min',
  '1h': '1h',
  '1h30': '1h30',
  '2h': '2h',
  '3h': '3h',
  '4h': '4h',
  'dia-todo': 'Dia todo',
};

function formatTime(time: string) {
  return time?.slice(0, 5) ?? '';
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatFullDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const formatted = date.toLocaleDateString('pt-BR', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const hours = Array.from({ length: 18 }, (_, i) => i + 5);

function getDurationMinutes(item: CalendarItem): number {
  if (item.source !== 'event') return 40;
  const dur = item.duration;
  if (!dur) return 60;
  switch (dur) {
    case '15min':
      return 15;
    case '30min':
      return 30;
    case '45min':
      return 45;
    case '1h':
      return 60;
    case '1h30':
      return 90;
    case '2h':
      return 120;
    case '3h':
      return 180;
    case '4h':
      return 240;
    case 'dia-todo':
      return 960;
    default:
      return 60;
  }
}

function getItemTopAndHeight(item: CalendarItem): { top: number; height: number } {
  const [h, m] = (item.event_time || '08:00').split(':').map(Number);
  const startMinutes = h * 60 + m;
  const baseMinutes = 5 * 60;
  const top = ((startMinutes - baseMinutes) / 60) * 72;
  const durationMinutes = getDurationMinutes(item);
  const height = Math.max((durationMinutes / 60) * 72, 36);
  return { top: Math.max(top, 0), height };
}

function getTimeFromY(y: number, containerTop: number): string {
  const relativeY = y - containerTop;
  const totalMinutes = Math.max(0, Math.round((relativeY / 72) * 60) + 5 * 60);
  const snappedMinutes = Math.round(totalMinutes / 15) * 15;
  const h = Math.floor(snappedMinutes / 60);
  const m = snappedMinutes % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * DayView component – displays a single day's calendar items.
 * Includes defensive checks for drag‑and‑drop callbacks to avoid runtime crashes.
 */
export default function DayView({
  currentDate,
  items,
  onItemClick,
  onDeleteEvent,
  deletingId,
  dragState,
  canDrag,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: DayViewProps) {
  const dateStr = formatDateStr(currentDate);
  const today = new Date();
  const todayStr = formatDateStr(today);
  const isToday = dateStr === todayStr;

  const dayItems = useMemo(() => items.filter((e) => e.event_date === dateStr), [items, dateStr]);
  const allDayItems = useMemo(() => dayItems.filter((e) => e.source === 'event' && e.duration === 'dia-todo'), [dayItems]);
  const timedItems = useMemo(() => dayItems.filter((e) => !(e.source === 'event' && e.duration === 'dia-todo')), [dayItems]);

  const nowH = today.getHours();
  const nowM = today.getMinutes();
  const nowTop = ((nowH * 60 + nowM) - 5 * 60) / 60 * 72;

  const dragOverTarget = dragState.dragOverTarget ?? '';
  const isDragOverThisDay = dragOverTarget.startsWith(`day-${dateStr}`);

  const handleAreaDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const time = getTimeFromY(e.clientY, rect.top);
      if (typeof onDragOver === 'function') {
        onDragOver(e, `day-${dateStr}-${time}`);
      }
    },
    [onDragOver, dateStr]
  );

  const handleAreaDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const time = getTimeFromY(e.clientY, rect.top);
      if (typeof onDrop === 'function') {
        onDrop(e, dateStr, time);
      }
    },
    [onDrop, dateStr]
  );

  // Helper para verificar se é item recorrente
  const isRecurrentItem = (item: CalendarItem): boolean => {
    return !!(item.recurrence_parent_id || (item.recurrence_type && item.recurrence_type !== 'none'));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 flex items-center justify-center rounded-xl ${
              isToday ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="text-xl font-bold">{currentDate.getDate()}</span>
          </div>
          <div>
            <h3
              className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {formatFullDate(currentDate)}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {dayItems.length === 0 ? 'Nenhum item' : `${dayItems.length} ite${dayItems.length > 1 ? 'ns' : 'm'}`}
              {dragState.isDragging && (
                <span className="ml-2 text-teal-500 font-medium">• Solte aqui para mover</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* All‑day items */}
      {allDayItems.length > 0 && (
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Dia inteiro
          </p>
          <div className="space-y-1.5">
            {allDayItems.map((item) => {
              const borderClass = typeColorBorder[item.type] ?? 'border-l-teal-500';
              const bgClass = typeColorBg[item.type] ?? 'bg-gray-50 dark:bg-gray-700';
              const textClass = typeColorText[item.type] ?? 'text-gray-700 dark:text-gray-300';
              const isDragged = dragState.isDragging && dragState.draggedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  draggable={canDrag(item)}
                  onDragStart={(e) => onDragStart(e, item)}
                  onDragEnd={onDragEnd}
                  onClick={() => onItemClick(item)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-[3px] transition-all hover:shadow-sm ${borderClass} ${bgClass} ${
                    canDrag(item) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } ${isDragged ? 'opacity-30 scale-95' : ''}`}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className={`${sourceIcons[item.source]} text-sm ${textClass}`}></i>
                  </div>
                  {isRecurrentItem(item) && (
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`ri-repeat-line text-xs ${textClass}`} title="Item recorrente"></i>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${textClass}`}>{item.title}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${bgClass} ${textClass}`}>
                    {typeLabels[item.type] ?? item.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex overflow-y-auto max-h-[600px]">
        {/* Time labels */}
        <div
          className="w-14 sm:w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 relative"
          style={{ minHeight: `${hours.length * 72}px` }}
        >
          {hours.map((h) => (
            <div key={h} className="absolute w-full flex items-start justify-end pr-2" style={{ top: `${(h - 5) * 72}px` }}>
              <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium -mt-2">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Items area */}
        <div
          className={`flex-1 relative transition-colors ${
            isDragOverThisDay && dragState.isDragging ? 'bg-teal-50/30 dark:bg-teal-900/5' : ''
          }`}
          style={{ minHeight: `${hours.length * 72}px` }}
          onDragOver={handleAreaDragOver}
          onDragLeave={onDragLeave}
          onDrop={handleAreaDrop}
        >
          {/* Horizontal lines */}
          {hours.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/50"
              style={{ top: `${(h - 5) * 72}px` }}
            ></div>
          ))}
          {hours.map((h) => (
            <div
              key={`half-${h}`}
              className="absolute left-0 right-0 border-t border-gray-50 dark:border-gray-700/25"
              style={{ top: `${(h - 5) * 72 + 36}px` }}
            ></div>
          ))}

          {/* Drop time indicator */}
          {isDragOverThisDay && dragState.isDragging && (() => {
            const timePart = dragOverTarget.split('-').slice(2).join('-');
            if (!timePart || !timePart.includes(':')) return null;
            const [hh, mm] = timePart.split(':').map(Number);
            const indicatorTop = ((hh * 60 + mm) - 5 * 60) / 60 * 72;
            if (indicatorTop < 0 || indicatorTop > hours.length * 72) return null;
            return (
              <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${indicatorTop}px` }}>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-teal-500 rounded-full -ml-1.5 flex-shrink-0 shadow-md"></div>
                  <div className="flex-1 h-[2px] bg-teal-500"></div>
                </div>
                <span className="absolute -top-5 left-4 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-sm border border-teal-200 dark:border-teal-800">
                  {timePart}
                </span>
              </div>
            );
          })()}

          {/* Current time line */}
          {isToday && nowTop >= 0 && nowTop <= hours.length * 72 && (
            <div className="absolute left-0 right-0 z-20" style={{ top: `${nowTop}px` }}>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1 flex-shrink-0"></div>
                <div className="flex-1 h-[2px] bg-red-500/80"></div>
              </div>
            </div>
          )}

          {/* Timed items */}
          {timedItems.map((item) => {
            const { top, height } = getItemTopAndHeight(item);
            const isCompact = height < 50;
            const borderClass =
              typeColorBorder[item.type] ?? (item.source === 'task' ? 'border-l-sky-500' : 'border-l-teal-500');
            const bgClass =
              typeColorBg[item.type] ?? (item.source === 'task' ? 'bg-sky-50 dark:bg-sky-900/15' : 'bg-gray-50 dark:bg-gray-700');
            const textClass =
              typeColorText[item.type] ?? (item.source === 'task' ? 'text-sky-700 dark:text-sky-400' : 'text-gray-700 dark:text-gray-300');
            const isDragged = dragState.isDragging && dragState.draggedItem?.id === item.id;

            return (
              <div
                key={item.id}
                draggable={canDrag(item)}
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStart(e, item);
                }}
                onDragEnd={onDragEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!dragState.isDragging) onItemClick(item);
                }}
                className={`absolute left-2 right-2 sm:left-3 sm:right-3 rounded-lg border-l-[3px] px-2.5 sm:px-3 py-1.5 overflow-hidden transition-all hover:shadow-lg hover:z-10 group ${borderClass} ${bgClass} ${
                  canDrag(item) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${isDragged ? 'opacity-30 scale-95 shadow-none' : ''}`}
                style={{ top: `${top}px`, height: `${height}px`, minHeight: '32px' }}
              >
                {isCompact ? (
                  <div className="flex items-center gap-2 h-full">
                    <i className={`${sourceIcons[item.source]} text-xs ${textClass}`}></i>
                    {isRecurrentItem(item) && (
                      <i className={`ri-repeat-line text-xs ${textClass}`} title="Item recorrente"></i>
                    )}
                    <p className={`text-xs font-semibold truncate ${textClass}`}>{item.title}</p>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto flex-shrink-0">
                      {item.source === 'event' ? formatTime(item.event_time) : sourceLabels[item.source]}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-0.5">
                      <i className={`${sourceIcons[item.source]} text-xs ${textClass}`}></i>
                      {isRecurrentItem(item) && (
                        <i className={`ri-repeat-line text-xs ${textClass}`} title="Item recorrente"></i>
                      )}
                      <p className={`text-xs sm:text-sm font-semibold truncate ${textClass}`}>{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">{sourceLabels[item.source]}</span>
                      {item.source === 'event' && (
                        <>
                          <span>• {formatTime(item.event_time)}</span>
                          {item.duration && <span>• {durationLabels[item.duration] ?? item.duration}</span>}
                        </>
                      )}
                      {item.meta?.status && <span>• {item.meta.status}</span>}
                    </div>
                    {height > 80 && item.meta?.projectName && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <i className="ri-folder-line"></i>
                        <span className="truncate">{item.meta.projectName}</span>
                      </div>
                    )}
                    {height > 80 && item.source === 'event' && item.location && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                        <i className="ri-map-pin-line"></i>
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}
                    {height > 100 && item.meta?.assignee && (
                      <div className="flex items-center gap-1 mt-1">
                        <div
                          className={`w-5 h-5 flex items-center justify-center rounded-full text-[8px] font-bold ${bgClass} ${textClass} border border-white dark:border-gray-800`}
                        >
                          {item.meta.assignee.trim().charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500">{item.meta.assignee}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Delete button (only for editable items) */}
                {!item.isReadOnly && (
                  <div
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteEvent(item.id);
                    }}
                  >
                    {deletingId === item.id ? (
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-loader-4-line animate-spin text-red-500 text-xs"></i>
                      </div>
                    ) : (
                      <div className="w-5 h-5 flex items-center justify-center rounded bg-white/80 dark:bg-gray-800/80 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer">
                        <i className="ri-delete-bin-line text-red-500 text-[10px]"></i>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {timedItems.length === 0 && allDayItems.length === 0 && !dragState.isDragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <i className="ri-calendar-line text-4xl text-gray-200 dark:text-gray-700 mb-2"></i>
                <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum item agendado</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
