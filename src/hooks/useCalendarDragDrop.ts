
import { useState, useCallback, useRef } from 'react';
import { CalendarItem } from '../services/calendarIntegrationService';
import { updateEvent } from '../services/calendarService';
import { supabase } from '../lib/supabaseClient';

export interface DragState {
  isDragging: boolean;
  draggedItem: CalendarItem | null;
  dragOverTarget: string | null;
  dragStartPos: { x: number; y: number } | null;
}

interface UseCalendarDragDropOptions {
  onEventMoved?: (item: CalendarItem, newDate: string, newTime?: string) => void;
  onOptimisticUpdate?: (itemId: string, newDate: string, newTime?: string) => void;
}

const sourceLabels: Record<string, string> = {
  event: 'Evento',
  task: 'Tarefa',
  project: 'Projeto',
  sprint: 'Sprint',
};

async function updateTaskDate(taskId: string, newDate: string): Promise<boolean> {
  // taskId comes as "task-<uuid>" or "task-<uuid>_recur_<date>"
  const rawId = taskId.replace(/^task-/, '');
  const realId = rawId.split('_recur_')[0];
  const { error } = await supabase
    .from('tasks')
    .update({ due_date: newDate, updated_at: new Date().toISOString() })
    .eq('id', realId);
  if (error) {
    console.error('Erro ao atualizar tarefa:', error);
    return false;
  }
  return true;
}

async function updateProjectDate(itemId: string, newDate: string): Promise<boolean> {
  // itemId formats: "proj-start-<uuid>", "proj-deadline-<uuid>", "proj-prazo-<uuid>"
  let field: string | null = null;
  let realId = '';

  if (itemId.startsWith('proj-start-')) {
    field = 'data_inicio';
    realId = itemId.replace('proj-start-', '');
  } else if (itemId.startsWith('proj-deadline-')) {
    field = 'deadline';
    realId = itemId.replace('proj-deadline-', '');
  } else if (itemId.startsWith('proj-prazo-')) {
    field = 'prazo';
    realId = itemId.replace('proj-prazo-', '');
  }

  if (!field || !realId) return false;

  const { error } = await supabase
    .from('projects')
    .update({ [field]: newDate, updated_at: new Date().toISOString() })
    .eq('id', realId);
  if (error) {
    console.error('Erro ao atualizar projeto:', error);
    return false;
  }
  return true;
}

async function updateSprintDate(itemId: string, newDate: string): Promise<boolean> {
  // itemId format: "sprint-<uuid>"
  const realId = itemId.replace('sprint-', '');
  const { error } = await supabase
    .from('project_sprints')
    .update({ end_date: newDate })
    .eq('id', realId);
  if (error) {
    console.error('Erro ao atualizar sprint:', error);
    return false;
  }
  return true;
}

export function useCalendarDragDrop(options?: UseCalendarDragDropOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedItem: null,
    dragOverTarget: null,
    dragStartPos: null,
  });

  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const dragItemRef = useRef<CalendarItem | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  }, []);

  const canDrag = useCallback((item: CalendarItem): boolean => {
    return !item.isReadOnly;
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: CalendarItem) => {
      if (!canDrag(item)) {
        e.preventDefault();
        return;
      }

      dragItemRef.current = item;
      setDragState({
        isDragging: true,
        draggedItem: item,
        dragOverTarget: null,
        dragStartPos: { x: e.clientX, y: e.clientY },
      });

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.id);

      // Ghost image styling
      const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
      ghost.style.opacity = '0.8';
      ghost.style.transform = 'scale(1.02)';
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      requestAnimationFrame(() => {
        document.body.removeChild(ghost);
      });
    },
    [canDrag]
  );

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState((prev) => ({
      ...prev,
      dragOverTarget: targetId,
    }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    setDragState((prev) => ({
      ...prev,
      dragOverTarget: null,
    }));
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDate: string, targetTime?: string) => {
      e.preventDefault();
      const item = dragItemRef.current;

      setDragState({
        isDragging: false,
        draggedItem: null,
        dragOverTarget: null,
        dragStartPos: null,
      });

      if (!item) return;

      const newDate = targetDate;
      const newTime = targetTime || item.event_time;

      // Skip if nothing changed
      if (newDate === item.event_date && newTime === item.event_time) return;

      // Optimistic update
      options?.onOptimisticUpdate?.(item.id, newDate, newTime);

      const label = sourceLabels[item.source] || 'Item';

      try {
        let success = false;

        if (item.source === 'event') {
          const result = await updateEvent(item.id, {
            event_date: newDate,
            event_time: newTime,
          });
          success = !!result;
        } else if (item.source === 'task') {
          success = await updateTaskDate(item.id, newDate);
        } else if (item.source === 'project') {
          success = await updateProjectDate(item.id, newDate);
        } else if (item.source === 'sprint') {
          success = await updateSprintDate(item.id, newDate);
        }

        if (success) {
          options?.onEventMoved?.(item, newDate, newTime);
          const dateObj = new Date(newDate + 'T12:00:00');
          const dayNum = dateObj.getDate();
          const monthNames = [
            'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
            'jul', 'ago', 'set', 'out', 'nov', 'dez',
          ];
          const monthStr = monthNames[dateObj.getMonth()];
          showToast(
            `${label} movido para ${dayNum} ${monthStr}${
              item.source === 'event' && targetTime ? ` às ${targetTime.slice(0, 5)}` : ''
            }`,
            'success'
          );
        } else {
          showToast(`Erro ao mover ${label.toLowerCase()}. Tente novamente.`, 'error');
          options?.onEventMoved?.(item, item.event_date, item.event_time);
        }
      } catch (err) {
        console.error('Drag drop update error:', err);
        showToast(`Erro ao mover ${label.toLowerCase()}. Tente novamente.`, 'error');
        options?.onEventMoved?.(item, item.event_date, item.event_time);
      }

      dragItemRef.current = null;
    },
    [options, showToast]
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedItem: null,
      dragOverTarget: null,
      dragStartPos: null,
    });
    dragItemRef.current = null;
  }, []);

  return {
    dragState,
    toast,
    canDrag,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
