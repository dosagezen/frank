import { useMemo, useCallback } from 'react';
import { CalendarItem } from '../../../services/calendarIntegrationService';
import { DragState } from '../../../hooks/useCalendarDragDrop';

interface WeekViewProps {
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

const dayNamesShort = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const dayNamesFull = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const hours = Array.from({ length: 16 }, (_, i) => i + 6);

function getItemTopAndHeight(item: CalendarItem): { top: number; height: number } {
  const [h, m] = (item.event_time || '08:00').split(':').map(Number);
  const startMinutes = h * 60 + m;
  const baseMinutes = 6 * 60;
  const top = ((startMinutes - baseMinutes) / 60) * 64;

  let durationMinutes = 60;
  if (item.source !== 'event') {
    durationMinutes = 40;
  } else {
    const dur = item.duration;
    if (dur === '15min') durationMinutes = 15;
    else if (dur === '30min') durationMinutes = 30;
    else if (dur === '45min') durationMinutes = 45;
    else if (dur === '1h') durationMinutes = 60;
    else if (dur === '1h30') durationMinutes = 90;
    else if (dur === '2h') durationMinutes = 120;
    else if (dur === '3h') durationMinutes = 180;
    else if (dur === '4h') durationMinutes = 240;
    else if (dur === 'dia-todo') durationMinutes = 960;
  }

  const height = Math.max((durationMinutes / 60) * 64, 28);
  return { top: Math.max(top, 0), height };
}

function getTimeFromY(y: number, containerTop: number): string {
  const relativeY = y - containerTop;
  const totalMinutes = Math.max(0, Math.round((relativeY / 64) * 60) + 6 * 60);
  const snappedMinutes = Math.round(totalMinutes / 15) * 15;
  const h = Math.floor(snappedMinutes / 60);
  const m = snappedMinutes % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function WeekView({
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
}: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const today = new Date();
  const todayStr = formatDateStr(today);

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    weekDays.forEach((d) => {
      const key = formatDateStr(d);
      map[key] = items.filter((e) => e.event_date === key);
    });
    return map;
  }, [items, weekDays]);

  const allDayByDay = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    weekDays.forEach((d) => {
      const key = formatDateStr(d);
      map[key] = (itemsByDay[key] || []).filter((e) => e.source === 'event' && e.duration === 'dia-todo');
    });
    return map;
  }, [itemsByDay, weekDays]);

  const hasAllDay = Object.values(allDayByDay).some((arr) => arr.length > 0);

  const nowH = today.getHours();
  const nowM = today.getMinutes();
  const nowTop = ((nowH * 60 + nowM) - 6 * 60) / 60 * 64;
  const isCurrentWeek = weekDays.some((d) => formatDateStr(d) === todayStr);
  const todayColIndex = weekDays.findIndex((d) => formatDateStr(d) === todayStr);

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, dateStr: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const time = getTimeFromY(e.clientY, rect.top);
      onDragOver(e, `week-${dateStr}-${time}`);
    },
    [onDragOver]
  );

  const handleColumnDrop = useCallback(
    (e: React.DragEvent, dateStr: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const time = getTimeFromY(e.clientY, rect.top);
      onDrop(e, dateStr, time);
    },
    [onDrop]
  );

  // Helper para verificar se é item recorrente
  const isRecurrentItem = (item: CalendarItem): boolean => {
    return !!(item.recurrence_parent_id || (item.recurrence_type && item.recurrence_type !== 'none'));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
        <div className="p-2 border-r border-gray-200 dark:border-gray-700"></div>
        {weekDays.map((d, i) => {
          const isToday = formatDateStr(d) === todayStr;
          const dateStr = formatDateStr(d);
          const isDragOverCol = dragState.dragOverTarget?.startsWith(`week-${dateStr}`);
          return (
            <div
              key={i}
              className={`p-2 sm:p-3 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-colors ${
                isToday ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
              } ${isDragOverCol ? 'bg-teal-50 dark:bg-teal-900/20' : ''}`}
            >
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <span className="hidden sm:inline">{dayNamesFull[i]}</span>
                <span className="sm:hidden">{dayNamesShort[i]}</span>
              </p>
              <p className={`text-lg sm:text-xl font-bold mt-0.5 ${isToday ? 'text-teal-600 dark:text-teal-400' : 'text-gray-900 dark:text-white'}`}>
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      {hasAllDay && (
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700">
          <div className="p-1 sm:p-2 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 font-medium">DIA</span>
          </div>
          {weekDays.map((d, i) => {
            const key = formatDateStr(d);
            const dayAllDay = allDayByDay[key] || [];
            return (
              <div key={i} className="p-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0 min-h-[32px]">
                {dayAllDay.map((ev) => (
                  <div
                    key={ev.id}
                    draggable={canDrag(ev)}
                    onDragStart={(e) => onDragStart(e, ev)}
                    onDragEnd={onDragEnd}
                    onClick={() => onItemClick(ev)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium truncate flex items-center gap-1 ${
                      canDrag(ev) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${typeColorBg[ev.type] || 'bg-gray-100 dark:bg-gray-700'} ${
                      typeColorText[ev.type] || 'text-gray-700 dark:text-gray-300'
                    } ${dragState.isDragging && dragState.draggedItem?.id === ev.id ? 'opacity-40 scale-95' : ''}`}
                  >
                    {isRecurrentItem(ev) && (
                      <i className="ri-repeat-line text-[9px] flex-shrink-0" title="Item recorrente"></i>
                    )}
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-y-auto max-h-[600px] relative">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] relative" style={{ minHeight: `${hours.length * 64}px` }}>
          {/* Time labels */}
          <div className="border-r border-gray-200 dark:border-gray-700 relative">
            {hours.map((h) => (
              <div
                key={h}
                className="h-16 flex items-start justify-end pr-2 pt-0"
                style={{ position: 'absolute', top: `${(h - 6) * 64}px`, width: '100%' }}
              >
                <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium -mt-2">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((d, colIdx) => {
            const key = formatDateStr(d);
            const dayItems = (itemsByDay[key] || []).filter((e) => !(e.source === 'event' && e.duration === 'dia-todo'));
            const isToday = key === todayStr;
            const dragOverTarget = dragState.dragOverTarget || '';
            const isDragOverThisCol = dragOverTarget.startsWith(`week-${key}`);

            return (
              <div
                key={colIdx}
                className={`relative border-r border-gray-200 dark:border-gray-700 last:border-r-0 transition-colors ${
                  isToday ? 'bg-teal-50/30 dark:bg-teal-900/5' : ''
                } ${isDragOverThisCol && dragState.isDragging ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''}`}
                onDragOver={(e) => handleColumnDragOver(e, key)}
                onDragLeave={onDragLeave}
                onDrop={(e) => handleColumnDrop(e, key)}
              >
                {hours.map((h) => (
                  <div key={h} className="absolute w-full border-t border-gray-100 dark:border-gray-700/50" style={{ top: `${(h - 6) * 64}px` }}></div>
                ))}

                {/* Drop time indicator */}
                {isDragOverThisCol && dragState.isDragging && (() => {
                  const timePart = dragOverTarget.split('-').slice(2).join('-');
                  if (!timePart || !timePart.includes(':')) return null;
                  const [hh, mm] = timePart.split(':').map(Number);
                  const indicatorTop = ((hh * 60 + mm) - 6 * 60) / 60 * 64;
                  if (indicatorTop < 0 || indicatorTop > hours.length * 64) return null;
                  return (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${indicatorTop}px` }}>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-teal-500 rounded-full -ml-1 flex-shrink-0 shadow-sm"></div>
                        <div className="flex-1 h-[2px] bg-teal-500"></div>
                      </div>
                      <span className="absolute -top-4 left-3 text-[9px] font-bold text-teal-600 dark:text-teal-400 bg-white dark:bg-gray-800 px-1 rounded shadow-sm">
                        {timePart}
                      </span>
                    </div>
                  );
                })()}

                {/* Current time line */}
                {isCurrentWeek && colIdx === todayColIndex && nowTop >= 0 && nowTop <= hours.length * 64 && (
                  <div className="absolute left-0 right-0 z-20" style={{ top: `${nowTop}px` }}>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full -ml-1 flex-shrink-0"></div>
                      <div className="flex-1 h-[2px] bg-red-500"></div>
                    </div>
                  </div>
                )}

                {/* Events */}
                {dayItems.map((item) => {
                  const { top, height } = getItemTopAndHeight(item);
                  const borderClass = typeColorBorder[item.type] || (item.source === 'task' ? 'border-l-sky-500' : 'border-l-teal-500');
                  const bgClass = typeColorBg[item.type] || (item.source === 'task' ? 'bg-sky-50 dark:bg-sky-900/15' : 'bg-gray-50 dark:bg-gray-700');
                  const textClass = typeColorText[item.type] || (item.source === 'task' ? 'text-sky-700 dark:text-sky-400' : 'text-gray-700 dark:text-gray-300');
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
                      className={`absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded-md border-l-[3px] px-1 sm:px-1.5 py-0.5 overflow-hidden transition-all hover:shadow-md hover:z-10 ${borderClass} ${bgClass} ${
                        canDrag(item) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${isDragged ? 'opacity-30 scale-95 shadow-none' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px`, minHeight: '24px' }}
                    >
                      <div className="flex items-center gap-0.5">
                        <i className={`${sourceIcons[item.source]} text-[8px] ${textClass}`}></i>
                        {isRecurrentItem(item) && (
                          <i className={`ri-repeat-line text-[8px] ${textClass}`} title="Item recorrente"></i>
                        )}
                        <p className={`text-[10px] sm:text-xs font-semibold truncate ${textClass}`}>{item.title}</p>
                      </div>
                      {height > 36 && (
                        <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {item.source === 'event' ? formatTime(item.event_time) : item.meta?.status || ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
