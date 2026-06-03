import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NewMeetingModal from './components/NewMeetingModal';
import EditEventModal from './components/EditEventModal';
import EventDetailsModal from './components/EventDetailsModal';
import CalendarItemDetailsModal from './components/CalendarItemDetailsModal';
import WeekView from './components/WeekView';
import DayView from './components/DayView';
import GanttView from './components/GanttView';
import { useAuth } from '../../contexts/AuthContext';
import { deleteEvent, CalendarEvent } from '../../services/calendarService';
import {
  fetchAllCalendarItems,
  fetchAllCalendarItemsForMonth,
  CalendarItem,
} from '../../services/calendarIntegrationService';
import { useCalendarDragDrop } from '../../hooks/useCalendarDragDrop';
import CellPreviewPopover from './components/CellPreviewPopover';
import { useCachedData } from '../../hooks/useCachedData';
import { invalidateCacheByPattern } from '../../services/localCache';
import { CACHE_KEYS } from '../../services/localCache';
import { supabase } from '../../lib/supabaseClient';

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

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

type ViewMode = 'month' | 'week' | 'day';
type SourceFilter = 'all' | 'event' | 'task' | 'project' | 'sprint';
type DisplayMode = 'calendar' | 'gantt';

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function getWeekLabel(date: Date): string {
  const { start, end } = getWeekRange(date);
  const sameMonth = start.getMonth() === end.getMonth();
  const startDay = start.getDate();
  const endDay = end.getDate();
  if (sameMonth) {
    return `${startDay} - ${endDay} de ${monthNames[start.getMonth()]} ${start.getFullYear()}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${startDay} ${monthNames[start.getMonth()].slice(
      0,
      3
    )} - ${endDay} ${monthNames[end.getMonth()].slice(0, 3)} ${start.getFullYear()}`;
  }
  return `${startDay} ${monthNames[start.getMonth()].slice(
    0,
    3
  )} ${start.getFullYear()} - ${endDay} ${monthNames[end.getMonth()].slice(
    0,
    3
  )} ${end.getFullYear()}`;
}

function getDayLabel(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const formatted = date.toLocaleDateString('pt-BR', options);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function CalendarioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [currentDayDate, setCurrentDayDate] = useState(new Date());

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [viewingItem, setViewingItem] = useState<CalendarItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('calendar');
  const [deleteRecurrentDialog, setDeleteRecurrentDialog] = useState<{ show: boolean; item: CalendarItem | null }>({ show: false, item: null });
  const [dotTooltip, setDotTooltip] = useState<{ day: number; x: number; y: number } | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ day: number; cellEl: HTMLElement } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Otimistic updates locais (para drag-drop sem invalidar cache)
  const [optimisticItems, setOptimisticItems] = useState<CalendarItem[] | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // ─── Chave de cache dinâmica por viewMode + período ───────────────────────
  const cacheKey = useMemo(() => {
    if (viewMode === 'month') {
      return `${CACHE_KEYS.CALENDARIO_PREFIX}month-${year}-${String(month + 1).padStart(2, '0')}`;
    }
    if (viewMode === 'week') {
      const { start } = getWeekRange(currentWeekDate);
      return `${CACHE_KEYS.CALENDARIO_PREFIX}week-${formatDateStr(start)}`;
    }
    return `${CACHE_KEYS.CALENDARIO_PREFIX}day-${formatDateStr(currentDayDate)}`;
  }, [viewMode, year, month, currentWeekDate, currentDayDate]);

  // ─── Fetch function estável por período ───────────────────────────────────
  const fetchFn = useCallback(async (): Promise<CalendarItem[]> => {
    if (!user) return [];
    if (viewMode === 'month') {
      return fetchAllCalendarItemsForMonth(user.id, year, month);
    }
    if (viewMode === 'week') {
      const { start, end } = getWeekRange(currentWeekDate);
      return fetchAllCalendarItems(user.id, formatDateStr(start), formatDateStr(end));
    }
    const dayStr = formatDateStr(currentDayDate);
    return fetchAllCalendarItems(user.id, dayStr, dayStr);
  }, [user, viewMode, year, month, currentWeekDate, currentDayDate]);

  // ─── useCachedData com TTL de 3 minutos ───────────────────────────────────
  const {
    data: cachedItems,
    loading,
    isRevalidating,
    retry: reloadItems,
    invalidate: invalidateCurrentCache,
  } = useCachedData<CalendarItem[]>(cacheKey, fetchFn, {
    ttl: 3 * 60 * 1000,
    enabled: !!user,
  });

  // Dados finais: otimistic override > cache
  const allItems = useMemo<CalendarItem[]>(() => {
    if (optimisticItems !== null) return optimisticItems;
    return cachedItems ?? [];
  }, [optimisticItems, cachedItems]);

  // Limpa override otimístico quando cache atualiza
  useEffect(() => {
    if (cachedItems !== null) setOptimisticItems(null);
  }, [cachedItems]);

  const filteredItems = useMemo(() => {
    if (sourceFilter === 'all') return allItems;
    return allItems.filter((item) => item.source === sourceFilter);
  }, [allItems, sourceFilter]);

  const getItemsForDay = useCallback(
    (day: number) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return filteredItems.filter((e) => e.event_date === dateStr);
    },
    [year, month, filteredItems]
  );

  const getItemsForDate = useCallback(
    (dateStr: string) => filteredItems.filter((e) => e.event_date === dateStr),
    [filteredItems]
  );

  const getTooltipText = useCallback(
    (day: number): string => {
      const items = getItemsForDay(day);
      if (items.length === 0) return '';
      const counts: Record<string, number> = {};
      items.forEach((item) => {
        const label = sourceLabels[item.source] || item.source;
        counts[label] = (counts[label] || 0) + 1;
      });
      const parts = Object.entries(counts).map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`);
      return `${items.length} ${items.length === 1 ? 'item' : 'itens'}: ${parts.join(', ')}`;
    },
    [getItemsForDay]
  );

  const handleOptimisticUpdate = useCallback((itemId: string, newDate: string, newTime?: string) => {
    setOptimisticItems((prev) => {
      const base = prev ?? allItems;
      return base.map((item) =>
        item.id === itemId ? { ...item, event_date: newDate, event_time: newTime || item.event_time } : item
      );
    });
  }, [allItems]);

  const { dragState, toast: dragToast, canDrag, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } = useCalendarDragDrop({
    onOptimisticUpdate: handleOptimisticUpdate,
    onEventMoved: () => {
      // Invalida todos os caches do calendário após mover um evento
      invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX);
      reloadItems();
    },
  });

  // Função de reload exposta para modais (invalida cache atual + rebusca)
  const loadItems = useCallback(() => {
    invalidateCurrentCache();
  }, [invalidateCurrentCache]);

  useEffect(() => {
    const eventIdParam = searchParams.get('eventId');
    if (eventIdParam && allItems.length > 0 && !viewingEvent && !viewingItem) {
      const targetItem = allItems.find((item) => item.id === eventIdParam);
      if (targetItem) {
        handleOpenItemDetails(targetItem);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('eventId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, allItems, viewingEvent, viewingItem]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handlePrev = () => {
    if (viewMode === 'month') { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDate(null); }
    else if (viewMode === 'week') { const d = new Date(currentWeekDate); d.setDate(d.getDate() - 7); setCurrentWeekDate(d); }
    else { const d = new Date(currentDayDate); d.setDate(d.getDate() - 1); setCurrentDayDate(d); }
  };

  const handleNext = () => {
    if (viewMode === 'month') { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDate(null); }
    else if (viewMode === 'week') { const d = new Date(currentWeekDate); d.setDate(d.getDate() + 7); setCurrentWeekDate(d); }
    else { const d = new Date(currentDayDate); d.setDate(d.getDate() + 1); setCurrentDayDate(d); }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setCurrentWeekDate(now);
    setCurrentDayDate(now);
    setSelectedDate(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    const item = allItems.find((i) => i.id === eventId);
    if (item && item.source !== 'event') {
      showToast('Este item não pode ser excluído daqui. Gerencie-o na página correspondente.', 'error');
      return;
    }
    if (item && isRecurrentItem(item)) {
      setDeleteRecurrentDialog({ show: true, item });
      return;
    }
    setDeletingId(eventId);
    try {
      const realId = eventId.includes('_recur_') ? eventId.split('_recur_')[0] : eventId;
      const success = await deleteEvent(realId);
      if (success) {
        setOptimisticItems((prev) => (prev ?? allItems).filter((e) => e.id !== eventId));
        await invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX);
        showToast('Evento excluído com sucesso!', 'success');
      } else {
        showToast('Erro ao excluir evento.', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Erro ao excluir evento.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRecurrentConfirm = async (option: 'this' | 'all') => {
    const item = deleteRecurrentDialog.item;
    if (!item) return;
    setDeletingId(item.id);

    // Extrair o ID real do pai
    const realParentId = item.recurrence_parent_id
      ? item.recurrence_parent_id
      : item.id.includes('_recur_')
        ? item.id.split('_recur_')[0]
        : item.id;

    try {
      if (option === 'all') {
        const success = await deleteEvent(realParentId);
        if (success) {
          setOptimisticItems((prev) =>
            (prev ?? allItems).filter((e) => {
              const eParentId = e.recurrence_parent_id
                ? e.recurrence_parent_id
                : e.id.includes('_recur_')
                  ? e.id.split('_recur_')[0]
                  : e.id;
              return eParentId !== realParentId;
            })
          );
          await invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX);
          showToast('Todas as ocorrências foram excluídas!', 'success');
        } else {
          showToast('Erro ao excluir evento.', 'error');
        }
      } else {
        // Excluir apenas esta ocorrência:
        // 1. Buscar o evento pai no banco
        const { data: parentData, error: fetchError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('id', realParentId)
          .maybeSingle();

        if (fetchError || !parentData) {
          showToast('Erro ao buscar evento original.', 'error');
          return;
        }

        const thisDate = item.event_date;

        // Calcular data anterior a esta ocorrência
        const [ty, tm, td] = thisDate.split('-').map(Number);
        const prevDate = new Date(ty, tm - 1, td - 1);
        const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

        // Calcular próxima ocorrência após esta data
        const nextDate = new Date(ty, tm - 1, td);
        switch (parentData.recurrence_type) {
          case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
          case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
          case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
        }
        const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

        // Verificar se há ocorrências futuras após esta data
        const recurrenceEndDate = parentData.recurrence_end_date
          ? new Date(parentData.recurrence_end_date + 'T00:00:00')
          : null;
        const hasOccurrencesAfter = !recurrenceEndDate || nextDate <= recurrenceEndDate;

        // 2. Excluir o evento pai
        const deleteSuccess = await deleteEvent(realParentId);
        if (!deleteSuccess) {
          showToast('Erro ao excluir evento.', 'error');
          return;
        }

        // 3. Recriar a série ANTES desta ocorrência (se houver datas anteriores)
        if (parentData.event_date < thisDate) {
          await supabase.from('calendar_events').insert({
            user_id: parentData.user_id,
            title: parentData.title,
            type: parentData.type,
            event_date: parentData.event_date,
            event_time: parentData.event_time,
            duration: parentData.duration,
            location: parentData.location,
            description: parentData.description,
            attendees: parentData.attendees,
            reminder: parentData.reminder,
            recurrence_type: parentData.recurrence_type,
            recurrence_end_date: prevDateStr,
            recurrence_parent_id: null,
            color: parentData.color,
          });
        }

        // 4. Recriar a série APÓS esta ocorrência (se houver datas futuras)
        if (hasOccurrencesAfter) {
          await supabase.from('calendar_events').insert({
            user_id: parentData.user_id,
            title: parentData.title,
            type: parentData.type,
            event_date: nextDateStr,
            event_time: parentData.event_time,
            duration: parentData.duration,
            location: parentData.location,
            description: parentData.description,
            attendees: parentData.attendees,
            reminder: parentData.reminder,
            recurrence_type: parentData.recurrence_type,
            recurrence_end_date: parentData.recurrence_end_date,
            recurrence_parent_id: null,
            color: parentData.color,
          });
        }

        // 5. Atualização otimística: remover apenas esta ocorrência da tela
        setOptimisticItems((prev) =>
          (prev ?? allItems).filter((e) => {
            const eParentId = e.recurrence_parent_id
              ? e.recurrence_parent_id
              : e.id.includes('_recur_')
                ? e.id.split('_recur_')[0]
                : e.id;
            // Manter itens que não são desta série, ou que são desta série mas em data diferente
            if (eParentId !== realParentId && e.id !== realParentId) return true;
            return e.event_date !== thisDate;
          })
        );
        await invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX);
        showToast('Ocorrência excluída com sucesso!', 'success');
      }
    } catch (err) {
      console.error('Delete recurrent error:', err);
      showToast('Erro ao excluir evento recorrente.', 'error');
    } finally {
      setDeletingId(null);
      setDeleteRecurrentDialog({ show: false, item: null });
    }
  };

  const handleOpenItemDetails = (item: CalendarItem) => {
    if (item.source === 'event') {
      const eventObj: CalendarEvent = {
        id: item.id, user_id: user?.id || '', title: item.title, type: item.type,
        event_date: item.event_date, event_time: item.event_time, duration: item.duration,
        location: item.location, description: item.description, attendees: item.attendees,
        reminder: item.reminder, color: item.color, created_at: item.created_at, updated_at: item.updated_at,
      };
      setViewingEvent(eventObj);
    } else {
      setViewingItem(item);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setViewingEvent(null);
    setEditingEvent(event);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    if (mode === 'week' && viewMode === 'day') setCurrentWeekDate(new Date(currentDayDate));
    else if (mode === 'day' && viewMode === 'week') setCurrentDayDate(new Date(currentWeekDate));
    else if (mode === 'week' && viewMode === 'month') setCurrentWeekDate(new Date());
    else if (mode === 'day' && viewMode === 'month') setCurrentDayDate(selectedDate ? new Date(year, month, selectedDate) : new Date());
    else if (mode === 'month' && viewMode === 'week') setCurrentMonth(new Date(currentWeekDate.getFullYear(), currentWeekDate.getMonth(), 1));
    else if (mode === 'month' && viewMode === 'day') setCurrentMonth(new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), 1));
    setViewMode(mode);
  };

  const isRecurrentItem = (item: CalendarItem): boolean =>
    !!(item.recurrence_parent_id || (item.recurrence_type && item.recurrence_type !== 'none'));

  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDayOfMonth = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  const selectedDateItems = selectedDate ? getItemsForDay(selectedDate) : [];

  const upcomingItems = filteredItems
    .filter((e) => {
      const eventDate = new Date(e.event_date + 'T00:00:00');
      return eventDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
    })
    .slice(0, 8);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayItems = filteredItems.filter((e) => e.event_date === todayStr);

  const sourceCounts = useMemo(() => {
    const counts = { all: allItems.length, event: 0, task: 0, project: 0, sprint: 0 };
    allItems.forEach((item) => {
      if (item.source in counts) counts[item.source as keyof typeof counts]++;
    });
    return counts;
  }, [allItems]);

  const navLabel = useMemo(() => {
    if (viewMode === 'month') return `${monthNames[month]} ${year}`;
    if (viewMode === 'week') return getWeekLabel(currentWeekDate);
    return getDayLabel(currentDayDate);
  }, [viewMode, month, year, currentWeekDate, currentDayDate]);

  const getDotColor = (item: CalendarItem): string => {
    if (item.source === 'task') return 'bg-sky-500';
    if (item.source === 'project') return item.type === 'project_deadline' ? 'bg-red-500' : 'bg-indigo-500';
    if (item.source === 'sprint') return 'bg-violet-500';
    return item.color || 'bg-teal-500';
  };

  const activeToast = dragToast.show ? dragToast : toast;

  const handleCellMouseEnter = useCallback(
    (day: number, cellEl: HTMLElement, dateStr?: string) => {
      const targetDateStr = dateStr || `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayItems = filteredItems.filter((e) => e.event_date === targetDateStr);
      if (dayItems.length === 0) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoverPreview(null);
        return;
      }
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => { setHoverPreview({ day, cellEl }); }, 350);
    },
    [year, month, filteredItems]
  );

  const handleCellMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
    hoverTimeoutRef.current = setTimeout(() => { setHoverPreview(null); }, 150);
  }, []);

  const handlePreviewClose = useCallback(() => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
    setHoverPreview(null);
  }, []);

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; month: number; year: number; dateStr: string; isCurrentMonth: boolean }> = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      const d = daysInPrevMonth - firstDayOfMonth + 1 + i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      cells.push({ day: d, month: m, year: y, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month, year, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
    }
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      cells.push({ day: i, month: m, year: y, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, isCurrentMonth: false });
    }
    return cells;
  }, [year, month, firstDayOfMonth, daysInMonth, daysInPrevMonth, totalCells]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Calendário</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Gerencie seus eventos e compromissos
            {isRevalidating && (
              <span className="ml-2 text-xs text-teal-500 dark:text-teal-400 inline-flex items-center gap-1">
                <i className="ri-loader-4-line animate-spin text-[10px]"></i>
                atualizando...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Calendário/Gantt */}
          <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
            <button
              onClick={() => setDisplayMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                displayMode === 'calendar'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <i className="ri-calendar-line text-sm"></i>
              Calendário
            </button>
            <button
              onClick={() => setDisplayMode('gantt')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                displayMode === 'gantt'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <i className="ri-bar-chart-horizontal-line text-sm"></i>
              Gantt
            </button>
          </div>

          <button onClick={() => setIsMeetingModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-add-line text-lg"></i>
            <span className="text-sm font-medium">Novo Evento</span>
          </button>
        </div>
      </div>

      {/* Nav bar - ocultar quando Gantt estiver ativo */}
      {displayMode === 'calendar' && (
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"><i className="ri-arrow-left-s-line text-lg"></i></button>
            <button onClick={handleToday} className="px-3 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap">Hoje</button>
            <button onClick={handleNext} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"><i className="ri-arrow-right-s-line text-lg"></i></button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white ml-1 whitespace-nowrap" style={{ fontFamily: 'Poppins, sans-serif' }}>{navLabel}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 gap-0.5">
              {(['all', 'event', 'task', 'project', 'sprint'] as SourceFilter[]).map((src) => (
                <button key={src} onClick={() => setSourceFilter(src)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${sourceFilter === src ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                  {src === 'all' ? `Todos (${sourceCounts.all})` : `${sourceLabels[src]} (${sourceCounts[src as keyof typeof sourceCounts]})`}
                </button>
              ))}
            </div>
            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
              {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
                <button key={mode} onClick={() => handleViewModeChange(mode)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${viewMode === mode ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                  {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {activeToast.show && (
        <div className={`fixed top-6 right-6 z-[60] px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 ${activeToast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} transition-all animate-[slideIn_0.3s_ease-out]`}>
          <i className={activeToast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
          {activeToast.message}
        </div>
      )}

      {/* Loading — somente no primeiro acesso (sem cache) */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Carregando calendário...</p>
          </div>
        </div>
      )}

      {/* GANTT VIEW */}
      {!loading && displayMode === 'gantt' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
          <GanttView />
        </div>
      )}

      {/* MONTH VIEW */}
      {!loading && displayMode === 'calendar' && viewMode === 'month' && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 max-w-full">
            {/* Calendário */}
            <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 min-w-0">
              <div className="grid grid-cols-7">
                {weekDays.map((day, idx) => (
                  <div key={day} className={`text-center text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 py-2 border-b border-gray-200 dark:border-gray-700 ${idx < 6 ? 'border-r border-r-gray-100 dark:border-r-gray-700/50' : ''}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 relative">
                {dotTooltip && !hoverPreview && (
                  <div className="fixed z-50 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[11px] font-medium rounded-lg shadow-xl pointer-events-none whitespace-nowrap animate-[fadeIn_0.15s_ease-out]" style={{ left: dotTooltip.x, top: dotTooltip.y, transform: 'translate(-50%, -100%)', marginTop: '-6px' }}>
                    {getTooltipText(dotTooltip.day)}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-gray-900 dark:border-t-gray-100"></div>
                  </div>
                )}
                {hoverPreview && (() => {
                  const cell = calendarCells.find((c) => c.day === hoverPreview.day && c.isCurrentMonth);
                  const previewDateStr = cell ? cell.dateStr : `${year}-${String(month + 1).padStart(2, '0')}-${String(hoverPreview.day).padStart(2, '0')}`;
                  const previewItems = filteredItems.filter((e) => e.event_date === previewDateStr);
                  if (previewItems.length === 0) return null;
                  return (
                    <CellPreviewPopover items={previewItems} day={hoverPreview.day} month={month} year={year} cellRef={hoverPreview.cellEl} onClose={handlePreviewClose} onItemClick={handleOpenItemDetails} />
                  );
                })()}
                {calendarCells.map((cell, i) => {
                  const isToday = cell.isCurrentMonth && isCurrentMonth && cell.day === todayDate;
                  const dayItems = getItemsForDate(cell.dateStr);
                  const hasItems = dayItems.length > 0;
                  const isSelected = cell.isCurrentMonth && selectedDate === cell.day;
                  const col = i % 7;
                  const row = Math.floor(i / 7);
                  const totalRows = Math.ceil(calendarCells.length / 7);
                  const isDragOver = dragState.dragOverTarget === `month-day-${cell.dateStr}`;
                  return (
                    <button
                      key={i}
                      onClick={() => { if (cell.isCurrentMonth) { setSelectedDate(cell.day); } else { setCurrentMonth(new Date(cell.year, cell.month, 1)); setSelectedDate(cell.day); } }}
                      onDoubleClick={() => { setCurrentDayDate(new Date(cell.year, cell.month, cell.day)); setViewMode('day'); }}
                      onDragOver={(e) => handleDragOver(e, `month-day-${cell.dateStr}`)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, cell.dateStr)}
                      onMouseEnter={(e) => { if (cell.isCurrentMonth) handleCellMouseEnter(cell.day, e.currentTarget as HTMLElement, cell.dateStr); }}
                      onMouseLeave={handleCellMouseLeave}
                      className={`aspect-square flex flex-col items-center justify-center text-xs sm:text-sm font-medium transition-all cursor-pointer relative ${row < totalRows - 1 ? 'border-b border-b-gray-100 dark:border-b-gray-700/50' : ''} ${col < 6 ? 'border-r border-r-gray-100 dark:border-r-gray-700/50' : ''} ${!cell.isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : isDragOver ? 'bg-teal-50 dark:bg-teal-900/20 ring-2 ring-inset ring-teal-400 dark:ring-teal-500' : isToday ? '' : isSelected ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-white'}`}
                    >
                      {hasItems && cell.isCurrentMonth && (
                        <span className={`absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold leading-none px-1 ${isToday ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' : isSelected ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{dayItems.length}</span>
                      )}
                      <span className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg ${!cell.isCurrentMonth ? '' : isToday ? 'bg-teal-600 text-white' : isSelected ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 ring-2 ring-teal-600 dark:ring-teal-400' : ''}`}>{cell.day}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Legenda:</span>
                {[['bg-teal-500', 'Eventos'], ['bg-sky-500', 'Tarefas'], ['bg-indigo-500', 'Projetos'], ['bg-red-500', 'Deadlines'], ['bg-violet-500', 'Sprints']].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5"><span className={`w-2 h-2 ${color} rounded-full`}></span><span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span></div>
                ))}
                <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
                  <i className="ri-drag-move-line text-xs text-gray-400"></i>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Arraste itens para mover</span>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{selectedDate ? `Dia ${selectedDate}` : 'Próximos'}</h3>
                {selectedDate && <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">Limpar</button>}
              </div>
              <div className="space-y-2">
                {(selectedDate ? selectedDateItems : upcomingItems).length === 0 ? (
                  <div className="text-center py-8">
                    <i className="ri-calendar-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDate ? 'Nenhum item neste dia' : 'Nenhum item próximo'}</p>
                  </div>
                ) : (
                  (selectedDate ? selectedDateItems : upcomingItems).map((item) => (
                    <div
                      key={item.id}
                      draggable={canDrag(item)}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group ${canDrag(item) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragState.isDragging && dragState.draggedItem?.id === item.id ? 'opacity-40 scale-95' : ''}`}
                      onClick={() => { if (!dragState.isDragging) handleOpenItemDetails(item); }}
                    >
                      <div className={`w-1 sm:w-2 h-12 sm:h-16 ${getDotColor(item)} rounded-full flex-shrink-0 hidden sm:block`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {canDrag(item) && <i className="ri-draggable text-[10px] text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"></i>}
                          <i className={`${sourceIcons[item.source]} text-[10px] text-gray-400 dark:text-gray-500`}></i>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase">{sourceLabels[item.source]}</span>
                          {isRecurrentItem(item) && <i className="ri-repeat-line text-[10px] text-teal-500 dark:text-teal-400" title="Item recorrente"></i>}
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{item.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {item.source === 'event' && <div className="flex items-center gap-1"><i className="ri-time-line"></i><span>{formatTime(item.event_time)}{item.duration ? ` • ${item.duration}` : ''}</span></div>}
                          {item.meta?.status && <span className="text-gray-400 dark:text-gray-500">{(item.meta.status === 'concluida' || item.meta.status === 'concluido' || item.meta.status === 'completed') ? '✓' : '○'} {item.meta.status}</span>}
                          {!selectedDate && <span className="text-gray-400 dark:text-gray-500">• Dia {new Date(item.event_date + 'T00:00:00').getDate()}</span>}
                        </div>
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{typeLabels[item.type] || item.type}</span>
                      </div>
                      {!item.isReadOnly && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(item.id); }} disabled={deletingId === item.id} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer" title="Excluir evento">
                          {deletingId === item.id ? <i className="ri-loader-4-line animate-spin text-red-500"></i> : <i className="ri-delete-bin-line text-red-500 dark:text-red-400"></i>}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Agenda de Hoje */}
          <div className="mt-4 sm:mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>Agenda de Hoje</h2>
            <div className="space-y-3 sm:space-y-4">
              {todayItems.length === 0 ? (
                <div className="text-center py-8">
                  <i className="ri-calendar-check-line text-4xl text-gray-300 dark:text-gray-600 mb-2"></i>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum item agendado para hoje</p>
                </div>
              ) : (
                todayItems.map((item) => (
                  <div
                    key={item.id}
                    draggable={canDrag(item)}
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${canDrag(item) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dragState.isDragging && dragState.draggedItem?.id === item.id ? 'opacity-40 scale-95' : ''}`}
                    onClick={() => { if (!dragState.isDragging) handleOpenItemDetails(item); }}
                  >
                    <div className={`w-1 sm:w-2 h-12 sm:h-16 ${getDotColor(item)} rounded-full flex-shrink-0 hidden sm:block`}></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{item.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {item.source === 'event' && <div className="flex items-center gap-1"><i className="ri-time-line"></i><span>{formatTime(item.event_time)}{item.duration ? ` • ${item.duration}` : ''}</span></div>}
                        {item.meta?.projectName && <div className="flex items-center gap-1"><i className="ri-folder-line"></i><span className="truncate max-w-[150px]">{item.meta.projectName}</span></div>}
                        {item.meta?.assignee && <div className="flex items-center gap-1"><i className="ri-user-line"></i><span>{item.meta.assignee}</span></div>}
                        {item.source === 'event' && item.attendees && <div className="flex items-center gap-1"><i className="ri-group-line"></i><span>{item.attendees.split(',').length} participantes</span></div>}
                        {item.source === 'event' && item.location && <div className="flex items-center gap-1"><i className="ri-map-pin-line"></i><span className="truncate max-w-[200px]">{item.location}</span></div>}
                      </div>
                    </div>
                    {item.source === 'event' && item.location && item.location.startsWith('http') && (
                      <a href={item.location} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="bg-teal-600 hover:bg-teal-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer self-start sm:self-auto">Entrar</a>
                    )}
                    {item.meta?.progress !== undefined && item.meta?.progress !== null && (
                      <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.meta.progress >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(item.meta.progress, 100)}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{item.meta.progress}%</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {!loading && displayMode === 'calendar' && viewMode === 'week' && (
        <WeekView currentDate={currentWeekDate} items={filteredItems} onItemClick={handleOpenItemDetails} onDeleteEvent={handleDeleteEvent} deletingId={deletingId} dragState={dragState} canDrag={canDrag} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd} />
      )}

      {!loading && displayMode === 'calendar' && viewMode === 'day' && (
        <DayView currentDate={currentDayDate} items={filteredItems} onItemClick={handleOpenItemDetails} onDeleteEvent={handleDeleteEvent} deletingId={deletingId} dragState={dragState} canDrag={canDrag} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd} />
      )}

      {/* Modals */}
      {isMeetingModalOpen && <NewMeetingModal isOpen={isMeetingModalOpen} onClose={() => setIsMeetingModalOpen(false)} onEventCreated={loadItems} />}
      {editingEvent && <EditEventModal event={editingEvent} isOpen={!!editingEvent} onClose={() => setEditingEvent(null)} onEventUpdated={() => { loadItems(); setEditingEvent(null); }} />}
      {viewingEvent && <EventDetailsModal event={viewingEvent} isOpen={!!viewingEvent} onClose={() => setViewingEvent(null)} onDelete={(eventId) => { handleDeleteEvent(eventId); setViewingEvent(null); }} onEdit={handleEditEvent} />}
      {viewingItem && <CalendarItemDetailsModal item={viewingItem} isOpen={!!viewingItem} onClose={() => setViewingItem(null)} onNavigate={(path) => { setViewingItem(null); navigate(path); }} />}

      {/* Delete Recurrent Dialog */}
      {deleteRecurrentDialog.show && deleteRecurrentDialog.item && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setDeleteRecurrentDialog({ show: false, item: null }); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded-full flex-shrink-0"><i className="ri-repeat-line text-2xl text-red-600 dark:text-red-400"></i></div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Excluir Item Recorrente</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Este é um item recorrente</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">Deseja excluir apenas esta ocorrência ou todas as ocorrências futuras deste item?</p>
              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
                <p className="text-xs text-teal-700 dark:text-teal-300 flex items-start gap-2">
                  <i className="ri-information-line text-sm flex-shrink-0 mt-0.5"></i>
                  <span><strong>Apenas esta ocorrência:</strong> Remove somente este item específico. <strong>Todas as ocorrências:</strong> Remove toda a série recorrente.</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
              <button type="button" onClick={() => handleDeleteRecurrentConfirm('this')} disabled={!!deletingId} className="w-full px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"><i className="ri-file-line"></i>Apenas esta ocorrência</button>
              <button type="button" onClick={() => handleDeleteRecurrentConfirm('all')} disabled={!!deletingId} className="w-full px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {deletingId ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Excluindo...</> : <><i className="ri-repeat-line"></i>Todas as ocorrências</>}
              </button>
              <button type="button" onClick={() => setDeleteRecurrentDialog({ show: false, item: null })} disabled={!!deletingId} className="w-full px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
