import { useState, useRef, useEffect, useMemo } from 'react';
import { useCachedData } from '../../../hooks/useCachedData';
import { fetchProjects, Project } from '../../../services/projectsService';
import { fetchTasks, Task } from '../../../services/tasksService';
import { fetchEvents, CalendarEvent, generateRecurrenceInstances } from '../../../services/calendarService';
import { useAuth } from '../../../contexts/AuthContext';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable, DragStartEvent, closestCenter, DragMoveEvent } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';
import { supabase } from '../../../lib/supabaseClient';
import { invalidateCache, invalidateCacheByPattern, CACHE_KEYS } from '../../../services/localCache';
import { useToast } from '../../../contexts/ToastContext';
import EventDetailsModal from './EventDetailsModal';
import EditEventModal from './EditEventModal';
import GanttHeader from './GanttHeader';
import GanttSidebar from './GanttSidebar';
import GanttTimeline from './GanttTimeline';
import GanttTooltip from './GanttTooltip';

interface HierarchyItem {
  id: string;
  type: 'project' | 'sprint' | 'task' | 'event';
  name: string;
  level: number;
  hasChildren?: boolean;
  color?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  projectId?: string;
  sprintId?: string;
  prazo?: Date;
  isRecurring?: boolean;
  occurrences?: Date[];
}

interface WeekInfo {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  daysInTimeline: number;
  monthYear: string;
}

interface MonthInfo {
  label: string;
  year: number;
  month: number;
  totalDays: number;
  weeks: WeekInfo[];
}

export default function GanttView() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTask, setActiveTask] = useState<HierarchyItem | null>(null);

  const [eventTooltip, setEventTooltip] = useState<{
    event: CalendarEvent;
    x: number;
    y: number;
  } | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [taskSprintOverrides, setTaskSprintOverrides] = useState<Map<string, string>>(new Map());
  const [taskPositionOverrides, setTaskPositionOverrides] = useState<Map<string, number>>(new Map());
  const [activeSprintId, setActiveSprintId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    sprintId: string;
    index: number;
  } | null>(null);

  // Buscar dados reais do Supabase
  const { data: projects = [], isLoading: loadingProjects } = useCachedData<Project[]>(
    'gantt-projects',
    fetchProjects,
    { ttl: 5 * 60 * 1000 }
  );

  const { data: tasks = [], isLoading: loadingTasks } = useCachedData<Task[]>(
    'gantt-tasks',
    fetchTasks,
    { ttl: 5 * 60 * 1000 }
  );

  const { data: rawEvents = [], isLoading: loadingEvents } = useCachedData<CalendarEvent[]>(
    'gantt-events',
    () => fetchEvents(user?.id || ''),
    { ttl: 5 * 60 * 1000, enabled: !!user }
  );

  const isLoading = loadingProjects || loadingTasks || loadingEvents;

  const safeProjects = Array.isArray(projects) ? projects : [];

  const safeTasks = useMemo(() => {
    const base = Array.isArray(tasks) ? tasks : [];
    if (taskSprintOverrides.size === 0 && taskPositionOverrides.size === 0) return base;
    
    return base.map((t) => {
      const sprintOverride = taskSprintOverrides.get(t.id);
      const positionOverride = taskPositionOverrides.get(t.id);
      
      let result = t;
      if (sprintOverride) result = { ...result, sprint_id: sprintOverride };
      if (positionOverride !== undefined) result = { ...result, position: positionOverride };
      
      return result;
    });
  }, [tasks, taskSprintOverrides, taskPositionOverrides]);

  const safeRawEvents = Array.isArray(rawEvents) ? rawEvents : [];

  // Processar projetos SEM filtrar por datas
  const projectsHierarchy: HierarchyItem[] = safeProjects.map((project) => {
    const hasSprints = project.sprints && project.sprints.length > 0;

    // ✅ FIX TIMEZONE para datas de projeto
    const parseLocalDate = (dateStr: string | undefined | null): Date | undefined => {
      if (!dateStr) return undefined;
      if (dateStr.includes('T')) return new Date(dateStr);
      return new Date(dateStr + 'T12:00:00');
    };

    return {
      id: project.id!,
      type: 'project' as const,
      name: project.nome,
      level: 0,
      hasChildren: hasSprints,
      color: project.cor || '#2dd4bf',
      startDate: parseLocalDate(project.data_inicio),
      endDate: parseLocalDate(project.deadline),
      prazo: parseLocalDate(project.prazo),
      projectId: project.id!,
    };
  });

  // Mapear sprints com IDs reais do banco
  const sprintsByProject = new Map<string, HierarchyItem[]>();
  safeProjects.forEach((project) => {
    if (project.sprints && project.sprints.length > 0 && project.id) {
      const sprints = project.sprints
        .map((sprint) => {
          const sprintId = sprint.id || '';
          if (!sprintId) return null;

          // ✅ FIX TIMEZONE: datas ISO (YYYY-MM-DD) são interpretadas como UTC
          // Adicionar T12:00:00 força horário local e evita deslocamento de fuso
          const parseLocalDate = (dateStr: string | undefined | null): Date | undefined => {
            if (!dateStr) return undefined;
            // Se já tem hora (ISO completo), usar direto
            if (dateStr.includes('T')) return new Date(dateStr);
            // Data simples (YYYY-MM-DD): forçar meio-dia local
            return new Date(dateStr + 'T12:00:00');
          };

          const endDate = parseLocalDate(sprint.endDate);

          // Aceitar tanto camelCase quanto snake_case
          const rawStartDate = (sprint as any).startDate || (sprint as any).start_date;
          let startDate: Date | undefined = parseLocalDate(rawStartDate);

          if (!startDate && endDate) {
            // Fallback: Calcular baseado nas tarefas da sprint
            const sprintTasks = safeTasks.filter(
              (t) => t.project_id === project.id && t.sprint_id === sprintId
            );

            if (sprintTasks.length > 0) {
              const taskDates = sprintTasks
                .filter((t) => t.prazo && t.prazo !== 'Sem prazo')
                .map((t) => {
                  const [day, month, year] = t.prazo.split('/').map(Number);
                  return new Date(year, month - 1, day);
                });

              if (taskDates.length > 0) {
                startDate = new Date(Math.min(...taskDates.map((d) => d.getTime())));
              }
            }

            // Fallback final: 2 semanas antes do fim
            if (!startDate) {
              startDate = new Date(endDate);
              startDate.setDate(startDate.getDate() - 14);
            }
          }

          return {
            id: sprintId,
            type: 'sprint' as const,
            name: sprint.name,
            level: 1,
            hasChildren: safeTasks.some(
              (t) => t.project_id === project.id && t.sprint_id === sprintId
            ),
            color: project.cor || '#2dd4bf',
            startDate,
            endDate,
            projectId: project.id!,
            sprintId,
          };
        })
        .filter(Boolean) as HierarchyItem[];

      sprintsByProject.set(project.id, sprints);
    }
  });

  // Mapear tarefas corretamente por sprint_id
  const tasksBySprint = new Map<string, HierarchyItem[]>();

  safeTasks.forEach((task) => {
    if (!task.sprint_id || !task.project_id) return;
    if (!task.prazo || task.prazo === 'Sem prazo') return;

    const [day, month, year] = task.prazo.split('/').map(Number);
    const endDate = new Date(year, month - 1, day);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 3);

    const taskItem: HierarchyItem = {
      id: task.id,
      type: 'task' as const,
      name: task.titulo,
      level: 2,
      status: task.status,
      startDate,
      endDate,
      projectId: task.project_id,
      sprintId: task.sprint_id,
    };

    const existing = tasksBySprint.get(task.sprint_id) || [];
    existing.push(taskItem);
    tasksBySprint.set(task.sprint_id, existing);
  });

  // ✅ Ordenar tarefas dentro de cada sprint por position (ASC), fallback para created_at
  tasksBySprint.forEach((tasks, sprintId) => {
    const tasksWithData = tasks.map((taskItem) => {
      const fullTask = safeTasks.find((t) => t.id === taskItem.id);
      return {
        ...taskItem,
        position: fullTask?.position ?? null,
        created_at: fullTask?.created_at ?? '',
      };
    });

    tasksWithData.sort((a, b) => {
      // Se ambos têm position, ordenar por position
      if (a.position !== null && b.position !== null) {
        return a.position - b.position;
      }
      // Se apenas um tem position, ele vem primeiro
      if (a.position !== null) return -1;
      if (b.position !== null) return 1;
      // Se nenhum tem position, ordenar por created_at
      return a.created_at.localeCompare(b.created_at);
    });

    tasksBySprint.set(sprintId, tasksWithData);
  });

  // Processar eventos — UMA linha por evento pai
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setMonth(rangeStart.getMonth() - 2);
  const rangeEnd = new Date(today);
  rangeEnd.setMonth(rangeEnd.getMonth() + 4);

  const formatDateForRange = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Agrupar instâncias por evento pai — uma entrada por evento
  const eventMap = new Map<string, HierarchyItem>();

  safeRawEvents.forEach((event) => {
    const instances = generateRecurrenceInstances(
      event,
      formatDateForRange(rangeStart),
      formatDateForRange(rangeEnd)
    );

    const parentId = event.id;
    const isRecurring = event.recurrence_type && event.recurrence_type !== 'none';

    if (!eventMap.has(parentId)) {
      const firstInstance = instances[0];
      eventMap.set(parentId, {
        id: parentId,
        type: 'event' as const,
        name: event.title,
        level: 1,
        color: event.color || '#6b7280',
        startDate: firstInstance ? new Date(firstInstance.event_date) : new Date(event.event_date),
        isRecurring: !!isRecurring,
        occurrences: [],
      });
    }

    const entry = eventMap.get(parentId)!;
    instances.forEach((instance) => {
      entry.occurrences!.push(new Date(instance.event_date));
    });
  });

  const allEvents: HierarchyItem[] = Array.from(eventMap.values());

  // Gerar lista hierárquica com EVENTOS PRIMEIRO
  const getVisibleItems = (): HierarchyItem[] => {
    const items: HierarchyItem[] = [];

    // ✅ SEÇÃO DE EVENTOS (sempre primeiro)
    items.push({
      id: 'events-section',
      type: 'project',
      name: 'Eventos',
      level: 0,
      hasChildren: allEvents.length > 0,
      color: '#6b7280',
    });

    // ✅ ADICIONAR EVENTOS INDIVIDUAIS quando expandido
    if (expandedItems.has('events-section')) {
      allEvents.forEach((event) => {
        items.push({
          id: event.id,
          type: 'event',
          name: event.name,
          level: 1,
          color: event.color,
          startDate: event.startDate,
          isRecurring: event.isRecurring,
          occurrences: event.occurrences,
        });
      });
    }

    // Projetos depois
    projectsHierarchy.forEach((project) => {
      items.push(project);
      if (expandedItems.has(project.id)) {
        const sprints = sprintsByProject.get(project.id) || [];
        sprints.forEach((sprint) => {
          items.push(sprint);
          if (expandedItems.has(sprint.id)) {
            const sprintTasks = tasksBySprint.get(sprint.id) || [];
            sprintTasks.forEach((task) => {
              items.push(task);
            });
          }
        });
      }
    });

    return items;
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'fazer':
        return '#6b7280';
      case 'fazendo':
        return '#3b82f6';
      case 'feito':
        return '#22c55e';
      case 'aguardando':
        return '#f59e0b';
      case 'parado':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // Calcular range de datas baseado nos dados reais
  const calculateDateRange = () => {
    const allDates: Date[] = [];

    projectsHierarchy.forEach((p) => {
      if (p.startDate) allDates.push(p.startDate);
      if (p.endDate) allDates.push(p.endDate);
    });

    sprintsByProject.forEach((sprints) => {
      sprints.forEach((s) => {
        if (s.startDate) allDates.push(s.startDate);
        if (s.endDate) allDates.push(s.endDate);
      });
    });

    tasksBySprint.forEach((tasks) => {
      tasks.forEach((t) => {
        if (t.startDate) allDates.push(t.startDate);
        if (t.endDate) allDates.push(t.endDate);
      });
    });

    allEvents.forEach((e) => {
      if (e.startDate) allDates.push(e.startDate);
    });

    if (allDates.length === 0) {
      const start = new Date();
      start.setMonth(start.getMonth() - 2);
      start.setDate(1);

      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);

      return { startDate: start, endDate: end };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    minDate.setDate(minDate.getDate() - 14);
    maxDate.setDate(maxDate.getDate() + 14);

    minDate.setDate(1);
    maxDate.setMonth(maxDate.getMonth() + 1);
    maxDate.setDate(0);

    return { startDate: minDate, endDate: maxDate };
  };

  const { startDate, endDate } = calculateDateRange();

  // ✅ NOVA LÓGICA: Calcular semanas contínuas ao longo do timeline
  const getMonthsWithWeeks = (): MonthInfo[] => {
    // 1. Recuar até a segunda-feira anterior ao startDate
    const firstMonday = new Date(startDate);
    const dayOfWeek = firstMonday.getDay(); // 0=dom, 1=seg, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    firstMonday.setDate(firstMonday.getDate() - daysToMonday);
    firstMonday.setHours(0, 0, 0, 0);

    // 2. Gerar todas as semanas do timeline (seg a dom)
    const allWeeks: WeekInfo[] = [];
    let currentWeekStart = new Date(firstMonday);

    while (currentWeekStart <= endDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // domingo

      const monthOfMonday = currentWeekStart.getMonth();
      const yearOfMonday = currentWeekStart.getFullYear();

      const visibleStart = currentWeekStart < startDate ? startDate : currentWeekStart;
      const visibleEnd = weekEnd > endDate ? endDate : weekEnd;
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysInTimeline = Math.ceil((visibleEnd.getTime() - visibleStart.getTime()) / msPerDay) + 1;

      allWeeks.push({
        weekNumber: 0,
        startDate: new Date(currentWeekStart),
        endDate: new Date(weekEnd),
        daysInTimeline,
        monthYear: `${yearOfMonday}-${monthOfMonday}`,
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    // 3. Agrupar semanas por mês e numerar
    const weeksByMonth = new Map<string, WeekInfo[]>();
    allWeeks.forEach((week) => {
      const key = week.monthYear;
      if (!weeksByMonth.has(key)) weeksByMonth.set(key, []);
      weeksByMonth.get(key)!.push(week);
    });

    weeksByMonth.forEach((weeks) => {
      weeks.forEach((week, index) => {
        week.weekNumber = index + 1;
      });
    });

    // 4. Gerar estrutura de meses
    const months: MonthInfo[] = [];
    const currentMonth = new Date(startDate);
    currentMonth.setDate(1);

    while (currentMonth <= endDate) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const monthKey = `${year}-${month}`;

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);

      const visibleStart = firstDayOfMonth < startDate ? startDate : firstDayOfMonth;
      const visibleEnd = lastDayOfMonth > endDate ? endDate : lastDayOfMonth;

      const msPerDay = 1000 * 60 * 60 * 24;
      const totalDays = Math.ceil((visibleEnd.getTime() - visibleStart.getTime()) / msPerDay) + 1;

      const monthNames = [
        'jan',
        'fev',
        'mar',
        'abr',
        'mai',
        'jun',
        'jul',
        'ago',
        'set',
        'out',
        'nov',
        'dez',
      ];

      months.push({
        label: `${monthNames[month]} ${year}`,
        year,
        month,
        totalDays,
        weeks: weeksByMonth.get(monthKey) || [],
      });

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    return months;
  };

  const months = getMonthsWithWeeks();
  const totalDays = months.reduce((sum, m) => sum + m.totalDays, 0);
  const dayWidth = 18;

  // Calcular posição da linha "Hoje" com timezone local
  const getTodayPosition = () => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysPassed = Math.floor(
      (todayDate.getTime() - startDateNormalized.getTime()) / msPerDay
    );

    return daysPassed * dayWidth;
  };

  // Verificar se uma data está no mês atual
  const isCurrentMonth = (year: number, month: number) => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month;
  };

  // Verificar se uma semana contém "Hoje"
  const isCurrentWeek = (week: WeekInfo) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now >= week.startDate && now <= week.endDate;
  };

  // Calcular posição e largura de uma barra baseado nas datas
  const getBarPosition = (itemStartDate?: Date, itemEndDate?: Date) => {
    if (!itemStartDate || !itemEndDate) return null;

    const start = new Date(itemStartDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(itemEndDate);
    end.setHours(23, 59, 59, 999);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysFromStart = Math.floor((start.getTime() - startDate.getTime()) / msPerDay);
    const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1);

    const left = daysFromStart * dayWidth;
    const width = duration * dayWidth;

    return { left, width };
  };

  // ✅ Nova função: calcular posição da extensão (prazo excedente)
  const getOverdueExtension = (deadline?: Date, prazo?: Date) => {
    if (!deadline || !prazo) return null;
    if (prazo <= deadline) return null;

    const deadlineNormalized = new Date(deadline);
    deadlineNormalized.setHours(23, 59, 59, 999);

    const prazoNormalized = new Date(prazo);
    prazoNormalized.setHours(23, 59, 59, 999);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysFromStart = Math.floor((deadlineNormalized.getTime() - startDate.getTime()) / msPerDay) + 1;
    const duration = Math.ceil((prazoNormalized.getTime() - deadlineNormalized.getTime()) / msPerDay);

    const left = daysFromStart * dayWidth;
    const width = duration * dayWidth;

    return { left, width };
  };

  // Scroll inicial com múltiplas tentativas para garantir aplicação
  useEffect(() => {
    if (isLoading) return;

    const attempts = [50, 150, 300, 500];
    const timers = attempts.map((delay) =>
      setTimeout(() => {
        const bodyContainer = scrollBodyRef.current;
        const headerContainer = timelineRef.current;

        if (!bodyContainer || !headerContainer) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const msPerDay = 1000 * 60 * 60 * 24;
        const daysPassed = Math.floor((today.getTime() - start.getTime()) / msPerDay);
        const todayPx = daysPassed * dayWidth;

        const visibleWidth = bodyContainer.clientWidth;
        const targetScroll = Math.max(0, todayPx - visibleWidth / 2);

        bodyContainer.scrollLeft = targetScroll;
        headerContainer.scrollLeft = targetScroll;
      }, delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isLoading, startDate, dayWidth]);

  // Sincronizar scroll entre header e corpo (horizontal + vertical)
  const handleBodyScroll = () => {
    if (timelineRef.current && scrollBodyRef.current) {
      timelineRef.current.scrollLeft = scrollBodyRef.current.scrollLeft;
    }
    if (leftColumnRef.current && scrollBodyRef.current) {
      if (Math.abs(leftColumnRef.current.scrollTop - scrollBodyRef.current.scrollTop) > 1) {
        leftColumnRef.current.scrollTop = scrollBodyRef.current.scrollTop;
      }
    }
  };

  // Sincronizar scroll da coluna esquerda para a direita
  const handleLeftScroll = () => {
    if (scrollBodyRef.current && leftColumnRef.current) {
      if (Math.abs(scrollBodyRef.current.scrollTop - leftColumnRef.current.scrollTop) > 1) {
        scrollBodyRef.current.scrollTop = leftColumnRef.current.scrollTop;
      }
    }
  };

  // ✅ Scroll suave para centralizar o dia atual
  const scrollToToday = () => {
    const bodyContainer = scrollBodyRef.current;
    const headerContainer = timelineRef.current;
    if (!bodyContainer || !headerContainer) return;

    const todayPx = getTodayPosition();
    const visibleWidth = bodyContainer.clientWidth;
    const targetScroll = Math.max(0, todayPx - visibleWidth / 2);

    bodyContainer.scrollTo({ left: targetScroll, behavior: 'smooth' });
    headerContainer.scrollTo({ left: targetScroll, behavior: 'smooth' });
  };

  // ✅ Tooltip com data completa
  const todayTooltip = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ✅ Função para atualizar sprint_id da tarefa com update otimista
  const handleTaskMove = async (
    taskId: string,
    newSprintId: string,
    taskName: string,
    sprintName: string
  ) => {
    // 1. Atualizar state local IMEDIATAMENTE (sem esperar o banco)
    setTaskSprintOverrides((prev) => {
      const next = new Map(prev);
      next.set(taskId, newSprintId);
      return next;
    });

    try {
      // 2. Atualizar o banco em background
      const { error } = await supabase
        .from('tasks')
        .update({ sprint_id: newSprintId, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      // 3. Invalidar caches para sincronizar o resto do app
      await Promise.all([
        invalidateCache('tasks_list'),
        invalidateCache('TASKS'),
        invalidateCache('painel-tasks'),
        invalidateCache('painel-deadlines'),
        invalidateCache('painel-stats'),
        invalidateCache('gantt-tasks'),
        invalidateCache('gantt-projects'),
      ]);

      showToast(`Tarefa "${taskName}" movida para "${sprintName}"`, 'success');
    } catch (error) {
      // Reverter o override otimista em caso de erro
      setTaskSprintOverrides((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      console.error('[GANTT] Erro ao mover tarefa:', error);
      showToast('Erro ao mover tarefa. Tente novamente.', 'error');
    }
  };

  // ✅ Função para reordenar tarefas dentro da mesma sprint
  const handleTaskReorder = async (sprintId: string, oldIndex: number, newIndex: number) => {
    const sprintTasks = tasksBySprint.get(sprintId);
    if (!sprintTasks) return;

    // 1. Reordenar array localmente
    const reorderedTasks = arrayMove(sprintTasks, oldIndex, newIndex);

    // 2. Atualizar positions otimisticamente
    const newPositions = new Map<string, number>();
    reorderedTasks.forEach((task, index) => {
      newPositions.set(task.id, index + 1);
    });

    setTaskPositionOverrides((prev) => {
      const next = new Map(prev);
      newPositions.forEach((position, taskId) => {
        next.set(taskId, position);
      });
      return next;
    });

    try {
      // 3. Atualizar o banco em batch
      const updates = reorderedTasks.map((task, index) => ({
        id: task.id,
        position: index + 1,
        updated_at: new Date().toISOString(),
      }));

      // Atualizar todas as tarefas em paralelo
      await Promise.all(
        updates.map((update) =>
          supabase
            .from('tasks')
            .update({ position: update.position, updated_at: update.updated_at })
            .eq('id', update.id)
        )
      );

      // 4. Invalidar caches
      await Promise.all([
        invalidateCache('tasks_list'),
        invalidateCache('TASKS'),
        invalidateCache('painel-tasks'),
        invalidateCache('gantt-tasks'),
      ]);

      showToast('Ordem das tarefas atualizada', 'success');
    } catch (error) {
      // Reverter overrides em caso de erro
      setTaskPositionOverrides((prev) => {
        const next = new Map(prev);
        newPositions.forEach((_, taskId) => {
          next.delete(taskId);
        });
        return next;
      });
      console.error('[GANTT] Erro ao reordenar tarefas:', error);
      showToast('Erro ao reordenar tarefas. Tente novamente.', 'error');
    }
  };

  // ✅ Handler de movimento do drag (para mostrar indicador)
  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDropIndicator(null);
      return;
    }

    const draggedTask = visibleItems.find(
      (item) => item.id === active.id && item.type === 'task'
    );

    if (!draggedTask) {
      setDropIndicator(null);
      return;
    }

    // Verificar se está sobre outra tarefa da mesma sprint
    const targetTask = visibleItems.find(
      (item) => item.id === over.id && item.type === 'task'
    );

    if (targetTask && draggedTask.sprintId === targetTask.sprintId) {
      const sprintId = draggedTask.sprintId;
      if (!sprintId) return;

      const sprintTasks = tasksBySprint.get(sprintId);
      if (!sprintTasks) return;

      const targetIndex = sprintTasks.findIndex((t) => t.id === targetTask.id);
      
      setDropIndicator({
        sprintId,
        index: targetIndex,
      });
    } else {
      setDropIndicator(null);
    }
  };

  // ✅ Handler de início do drag
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskItem = visibleItems.find(
      (item) => item.id === active.id && item.type === 'task'
    );
    if (taskItem) {
      setActiveTask(taskItem);
      setActiveSprintId(taskItem.sprintId || null);
    }
  };

  // ✅ Handler de fim do drag
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveSprintId(null);
    setDropIndicator(null);

    if (!over) return;

    const draggedTask = visibleItems.find(
      (item) => item.id === active.id && item.type === 'task'
    );

    if (!draggedTask) return;

    // Caso 1: Soltar sobre uma sprint (mover entre sprints)
    const targetSprint = visibleItems.find(
      (item) => item.id === over.id && item.type === 'sprint'
    );

    if (targetSprint) {
      if (draggedTask.sprintId === targetSprint.id) return;

      if (draggedTask.projectId !== targetSprint.projectId) {
        showToast('Não é possível mover tarefas entre projetos diferentes', 'error');
        return;
      }

      handleTaskMove(draggedTask.id, targetSprint.id, draggedTask.name, targetSprint.name);
      return;
    }

    // Caso 2: Soltar sobre outra tarefa (reordenar dentro da mesma sprint)
    const targetTask = visibleItems.find(
      (item) => item.id === over.id && item.type === 'task'
    );

    if (targetTask && draggedTask.sprintId === targetTask.sprintId) {
      const sprintId = draggedTask.sprintId;
      if (!sprintId) return;

      const sprintTasks = tasksBySprint.get(sprintId);
      if (!sprintTasks) return;

      const oldIndex = sprintTasks.findIndex((t) => t.id === draggedTask.id);
      const newIndex = sprintTasks.findIndex((t) => t.id === targetTask.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        handleTaskReorder(sprintId, oldIndex, newIndex);
      }
    }
  };

  // ✅ Componente de tarefa sortable (para reordenar dentro da sprint)
  const SortableTask = ({
    item,
    children,
  }: {
    item: HierarchyItem;
    children: React.ReactNode;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: item.id,
      data: { type: 'task', sprintId: item.sprintId, projectId: item.projectId },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition || 'transform 200ms ease',
      opacity: isDragging ? 0.5 : 1,
      cursor: 'grab',
      position: 'relative' as const,
    };

    // ✅ Verificar se deve mostrar indicador de drop acima desta tarefa
    const showIndicator = dropIndicator && 
      dropIndicator.sprintId === item.sprintId && 
      dropIndicator.index === tasksBySprint.get(item.sprintId!)?.findIndex((t) => t.id === item.id);

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {/* ✅ Linha indicadora de drop */}
        {showIndicator && (
          <div className="absolute -top-[1px] left-0 right-0 h-[2px] bg-blue-500 z-30 pointer-events-none">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
          </div>
        )}
        {children}
      </div>
    );
  };

  // ✅ Componente de tarefa draggable (para mover entre sprints)
  const DraggableTask = ({
    item,
    children,
  }: {
    item: HierarchyItem;
    children: React.ReactNode;
  }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: item.id,
      data: { type: 'task', sprintId: item.sprintId, projectId: item.projectId },
    });

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}
      >
        {children}
      </div>
    );
  };

  // ✅ Componente de sprint droppable
  const DroppableSprint = ({
    item,
    children,
  }: {
    item: HierarchyItem;
    children: React.ReactNode;
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: item.id,
      data: { type: 'sprint', sprintId: item.id, projectId: item.projectId },
    });

    return (
      <div
        ref={setNodeRef}
        style={{
          backgroundColor: isOver ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          borderLeft: isOver ? '3px solid #3b82f6' : '3px solid transparent',
          transition: 'all 0.2s ease',
        }}
      >
        {children}
      </div>
    );
  };

  // ✅ Buscar evento completo pelo id (a partir dos dados brutos)
  const getFullEventById = (id: string): CalendarEvent | null => {
    return safeRawEvents.find((e) => e.id === id) ?? null;
  };

  // ✅ Abrir modal de detalhes do evento
  const handleEventClick = (id: string) => {
    const fullEvent = getFullEventById(id);
    if (fullEvent) {
      setEventTooltip(null);
      setViewingEvent(fullEvent);
    }
  };

  // ✅ Abrir modal de edição
  const handleEditEvent = (event: CalendarEvent) => {
    setViewingEvent(null);
    setEditingEvent(event);
  };

  // ✅ Excluir evento e invalidar caches
  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      setViewingEvent(null);
      await Promise.all([
        invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX),
        invalidateCache('gantt-events'),
      ]);
      showToast('Evento excluído com sucesso', 'success');
    } catch (err) {
      console.error('[GANTT] Erro ao excluir evento:', err);
      showToast('Erro ao excluir evento. Tente novamente.', 'error');
    }
  };

  // ✅ Após editar evento, fechar modal e invalidar caches
  const handleEventUpdated = async () => {
    setEditingEvent(null);
    await Promise.all([
      invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX),
      invalidateCache('gantt-events'),
    ]);
    showToast('Evento atualizado com sucesso', 'success');
  };

  const visibleItems = getVisibleItems();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900">
        <div className="text-zinc-400">Carregando dados do Gantt...</div>
      </div>
    );
  }

  return (
    <DndContext 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      collisionDetection={closestCenter}
    >
      <div className="flex flex-col h-full bg-zinc-900">
        <style>{`
          .gantt-scroll::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .gantt-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .gantt-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.12);
            border-radius: 3px;
          }
          .gantt-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          .gantt-scroll {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
          }
        `}</style>

        <GanttHeader
          months={months}
          dayWidth={dayWidth}
          totalDays={totalDays}
          timelineRef={timelineRef}
          isCurrentMonth={isCurrentMonth}
          isCurrentWeek={isCurrentWeek}
        />

        <div className="flex flex-1 overflow-hidden">
          <GanttSidebar
            visibleItems={visibleItems}
            expandedItems={expandedItems}
            tasksBySprint={tasksBySprint}
            leftColumnRef={leftColumnRef}
            toggleExpand={toggleExpand}
            getStatusColor={getStatusColor}
            handleLeftScroll={handleLeftScroll}
            handleEventClick={handleEventClick}
            getFullEventById={getFullEventById}
            setEventTooltip={setEventTooltip}
            SortableTask={SortableTask}
            DroppableSprint={DroppableSprint}
            DraggableTask={DraggableTask}
          />

          <GanttTimeline
            visibleItems={visibleItems}
            months={months}
            dayWidth={dayWidth}
            totalDays={totalDays}
            startDate={startDate}
            scrollBodyRef={scrollBodyRef}
            handleBodyScroll={handleBodyScroll}
            getTodayPosition={getTodayPosition}
            scrollToToday={scrollToToday}
            todayTooltip={todayTooltip}
            getBarPosition={getBarPosition}
            getOverdueExtension={getOverdueExtension}
            getStatusColor={getStatusColor}
            handleEventClick={handleEventClick}
            getFullEventById={getFullEventById}
            setEventTooltip={setEventTooltip}
          />
        </div>

        {/* Legenda */}
        <div className="border-t border-zinc-800 bg-zinc-900 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-5 rounded-md" style={{ backgroundColor: '#2dd4bf', opacity: 0.85 }}></div>
              <span className="text-xs text-zinc-400">Projeto</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-4 rounded" style={{ backgroundColor: '#2dd4bf', opacity: 0.45 }}></div>
              <span className="text-xs text-zinc-400">Sprint</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6b7280' }}></div>
                <span className="text-xs text-zinc-400">Fazer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                <span className="text-xs text-zinc-400">Fazendo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
                <span className="text-xs text-zinc-400">Feito</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-px h-5 bg-red-500/60"></div>
              <span className="text-xs text-zinc-400">Hoje</span>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getStatusColor(activeTask.status) }}
                />
                <span className="text-xs text-zinc-300">{activeTask.name}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>

      <GanttTooltip eventTooltip={eventTooltip} />

      {viewingEvent && (
        <EventDetailsModal
          event={viewingEvent}
          isOpen={!!viewingEvent}
          onClose={() => setViewingEvent(null)}
          onDelete={handleDeleteEvent}
          onEdit={handleEditEvent}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          onEventUpdated={handleEventUpdated}
        />
      )}
    </DndContext>
  );
}
