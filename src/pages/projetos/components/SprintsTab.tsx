import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { supabase } from '../../../lib/supabaseClient';
import UserAvatar from '../../../components/base/UserAvatar';
import QuickAddTaskInSprint from './QuickAddTaskInSprint';
import TaskFormModal from '../../tarefas/components/TaskFormModal';
import { formatDateBR } from '../../../utils/dateHelpers';

interface SprintsTabProps {
  project: any;
}

interface RealTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  due_date: string | null;
  sprint_id: string | null;
  project_id: string;
  responsavel_id: string | null;
  progress: number | null;
  categoria: string | null;
  description?: string | null;
  tags?: string[] | null;
  tempo_estimado?: string | null;
  recurrence_type?: string | null;
  recurrence_end_date?: string | null;
  observacoes?: string | null;
  user_id?: string | null;
}

interface SprintData {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  sprint_order: number;
  members: string[];
  tasks: RealTask[];
}

interface MemberProfile {
  id: string;
  nome: string;
  avatar_url: string;
  cargo: string;
}

// ── Componente de tarefa arrastável ──
function DraggableTask({
  task,
  children,
}: {
  task: RealTask;
  children: (dragHandleProps: any, isDragging: boolean) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
  });

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}

// ── Zona de drop da sprint ──
function DroppableSprint({
  sprintId,
  children,
  isOver,
}: {
  sprintId: string;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: `sprint-${sprintId}` });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-0 rounded-lg transition-all duration-200 ${
        isOver
          ? 'bg-teal-50/80 dark:bg-teal-900/20 ring-2 ring-teal-400 dark:ring-teal-500 ring-inset'
          : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function SprintsTab({ project }: SprintsTabProps) {
  const [sprintsData, setSprintsData] = useState<SprintData[]>([]);
  const [orphanTasks, setOrphanTasks] = useState<RealTask[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Map<string, MemberProfile>>(new Map());
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAddSprintId, setQuickAddSprintId] = useState<string | null>(null);

  // ── Drag and Drop state ──
  const [activeTask, setActiveTask] = useState<RealTask | null>(null);
  const [overSprintId, setOverSprintId] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [moveSuccess, setMoveSuccess] = useState<string | null>(null);

  // ── Estado para o modal de detalhes da tarefa ──
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // ── Estado para vinculação em massa de tarefas órfãs ──
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [linkingTasks, setLinkingTasks] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const isLoadingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    if (!project?.id) return;
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    if (isMountedRef.current) {
      setLoading(true);
      setError(null);
    }

    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && isLoadingRef.current) {
        isLoadingRef.current = false;
        setLoading(false);
        setError('Tempo limite excedido. Verifique sua conexão e tente novamente.');
      }
    }, 15000);

    try {
      const [sprintsRes, tasksRes] = await Promise.all([
        supabase
          .from('project_sprints')
          .select('id, name, start_date, end_date, status, sprint_order, members')
          .eq('project_id', project.id)
          .order('sprint_order', { ascending: true }),
        supabase
          .from('tasks')
          .select('id, title, description, status, priority, assignee, due_date, sprint_id, project_id, responsavel_id, progress, categoria, tags, tempo_estimado, recurrence_type, recurrence_end_date, observacoes, user_id')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false }),
      ]);

      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;
      if (sprintsRes.error) throw sprintsRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const sprints = sprintsRes.data || [];
      const tasks = (tasksRes.data || []) as RealTask[];

      const profileIds = new Set<string>();
      sprints.forEach((s: any) => {
        if (s.members && Array.isArray(s.members)) {
          s.members.forEach((m: string) => { if (m && m.length > 20) profileIds.add(m); });
        }
      });
      tasks.forEach((t: RealTask) => { if (t.responsavel_id) profileIds.add(t.responsavel_id); });

      let profilesMap = new Map<string, MemberProfile>();
      if (profileIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome, avatar_url, cargo')
          .in('id', Array.from(profileIds));
        if (profiles && isMountedRef.current) {
          profiles.forEach((p: any) => profilesMap.set(p.id, p));
        }
      }

      if (!isMountedRef.current) return;
      setMemberProfiles(profilesMap);

      const tasksBySprint = new Map<string, RealTask[]>();
      const orphans: RealTask[] = [];

      tasks.forEach((task) => {
        if (task.sprint_id) {
          const list = tasksBySprint.get(task.sprint_id) || [];
          list.push(task);
          tasksBySprint.set(task.sprint_id, list);
        } else {
          orphans.push(task);
        }
      });

      const sprintsWithTasks: SprintData[] = sprints.map((sprint: any) => ({
        id: sprint.id,
        name: sprint.name,
        start_date: sprint.start_date,
        end_date: sprint.end_date,
        status: sprint.status || 'pendente',
        sprint_order: sprint.sprint_order || 0,
        members: sprint.members || [],
        tasks: tasksBySprint.get(sprint.id) || [],
      }));

      setSprintsData(sprintsWithTasks);
      setOrphanTasks(orphans);

      // Inicializar seleções de vinculação para tarefas órfãs
      const initialSelections: Record<string, string> = {};
      orphans.forEach((t) => { initialSelections[t.id] = ''; });
      setLinkSelections(initialSelections);

      setExpandedSprints(new Set());
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;
      setError('Erro ao carregar sprints e tarefas. Tente novamente.');
    } finally {
      if (isMountedRef.current) setLoading(false);
      isLoadingRef.current = false;
    }
  }, [project?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Drag handlers ──
  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as RealTask;
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    if (overId?.startsWith('sprint-')) {
      setOverSprintId(overId.replace('sprint-', ''));
    } else {
      setOverSprintId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverSprintId(null);

    if (!over) return;

    const task = active.data.current?.task as RealTask;
    const overId = over.id as string;

    if (!overId.startsWith('sprint-')) return;

    const targetSprintId = overId.replace('sprint-', '');
    const newSprintId = targetSprintId === 'orphan' ? null : targetSprintId;

    // Não mover se já está na mesma sprint
    if (task.sprint_id === newSprintId) return;

    const targetSprint = newSprintId
      ? sprintsData.find((s) => s.id === newSprintId)
      : null;
    const targetName = targetSprint ? targetSprint.name : 'Sem Sprint';

    setMovingTaskId(task.id);

    // Atualização otimista local
    setSprintsData((prev) =>
      prev.map((sprint) => ({
        ...sprint,
        tasks: sprint.tasks.filter((t) => t.id !== task.id),
      }))
    );
    setOrphanTasks((prev) => prev.filter((t) => t.id !== task.id));

    const updatedTask = { ...task, sprint_id: newSprintId };

    if (newSprintId) {
      setSprintsData((prev) =>
        prev.map((sprint) =>
          sprint.id === newSprintId
            ? { ...sprint, tasks: [updatedTask, ...sprint.tasks] }
            : sprint
        )
      );
    } else {
      setOrphanTasks((prev) => [updatedTask, ...prev]);
    }

    // Expandir sprint de destino
    if (newSprintId) {
      setExpandedSprints((prev) => {
        const next = new Set(prev);
        next.add(newSprintId);
        return next;
      });
    } else {
      setExpandedSprints((prev) => {
        const next = new Set(prev);
        next.add('orphan');
        return next;
      });
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ sprint_id: newSprintId })
        .eq('id', task.id);

      if (error) throw error;

      setMoveSuccess(`"${task.title}" movida para ${targetName}`);
      setTimeout(() => setMoveSuccess(null), 3000);
    } catch {
      // Reverter em caso de erro
      loadData();
    } finally {
      setMovingTaskId(null);
    }
  };

  const toggleSprint = (id: string) => {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => setExpandedSprints(new Set());
  const expandAll = () => {
    const allIds = new Set<string>();
    sprintsData.forEach((s) => allIds.add(s.id));
    if (orphanTasks.length > 0) allIds.add('orphan');
    setExpandedSprints(allIds);
  };

  const isTaskDone = (status: string) =>
    ['feito', 'concluida', 'concluido', 'done'].includes(status);
  const isTaskInProgress = (status: string) =>
    ['em-andamento', 'fazendo', 'doing'].includes(status);

  const getSprintStatusStyle = (status: string) => {
    switch (status) {
      case 'concluida': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'ativa':
      case 'em-andamento': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getSprintStatusLabel = (status: string) => {
    switch (status) {
      case 'concluida': return 'Concluída';
      case 'ativa': return 'Ativa';
      case 'em-andamento': return 'Em Andamento';
      case 'pendente': return 'Pendente';
      default: return status;
    }
  };

  const getTaskStatusStyle = (status: string) => {
    if (isTaskDone(status)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (isTaskInProgress(status)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (status === 'aguardando') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  };

  const getTaskStatusLabel = (status: string) => {
    if (isTaskDone(status)) return 'Concluída';
    if (isTaskInProgress(status)) return 'Em Andamento';
    if (status === 'aguardando') return 'Aguardando';
    if (status === 'fazer' || status === 'todo') return 'A Fazer';
    return status;
  };

  const getTaskStatusIcon = (status: string) => {
    if (isTaskDone(status)) return 'ri-checkbox-circle-fill text-emerald-500 dark:text-emerald-400';
    if (isTaskInProgress(status)) return 'ri-loader-4-line text-blue-500 dark:text-blue-400';
    if (status === 'aguardando') return 'ri-time-line text-amber-500 dark:text-amber-400';
    return 'ri-checkbox-blank-circle-line text-gray-400 dark:text-gray-500';
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'alta': return 'ri-arrow-up-s-fill text-red-500';
      case 'media': return 'ri-arrow-right-s-fill text-amber-500';
      case 'baixa': return 'ri-arrow-down-s-fill text-emerald-500';
      default: return 'ri-subtract-line text-gray-400';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'alta': return 'Alta';
      case 'media': return 'Média';
      case 'baixa': return 'Baixa';
      default: return priority;
    }
  };

  const totalSprints = sprintsData.length;
  const totalTasks = sprintsData.reduce((acc, s) => acc + s.tasks.length, 0) + orphanTasks.length;
  const totalDone = sprintsData.reduce((acc, s) => acc + s.tasks.filter((t) => isTaskDone(t.status)).length, 0) +
    orphanTasks.filter((t) => isTaskDone(t.status)).length;
  const totalInProgress = sprintsData.reduce((acc, s) => acc + s.tasks.filter((t) => isTaskInProgress(t.status)).length, 0) +
    orphanTasks.filter((t) => isTaskInProgress(t.status)).length;
  const globalProgress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-3 border-teal-200 dark:border-teal-800 border-t-teal-600 dark:border-t-teal-400 rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando sprints e tarefas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <i className="ri-error-warning-line text-2xl text-red-500"></i>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={loadData} className="px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-refresh-line mr-1"></i>Tentar novamente
        </button>
      </div>
    );
  }

  if (totalSprints === 0 && orphanTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 dark:text-gray-500">
        <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700/50">
          <i className="ri-stack-line text-3xl"></i>
        </div>
        <p className="text-base font-medium text-gray-600 dark:text-gray-300">Nenhuma Sprint ou Tarefa</p>
        <p className="text-sm">Crie sprints e tarefas para acompanhar o progresso do projeto</p>
      </div>
    );
  }

  const convertToTaskFormat = (task: RealTask): any => {
    const profile = task.responsavel_id ? memberProfiles.get(task.responsavel_id) : null;
    return {
      id: task.id,
      titulo: task.title,
      descricao: task.description || '',
      status: task.status,
      prioridade: task.priority,
      prazo: task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : 'Sem prazo',
      categoria: task.categoria || '',
      tags: task.tags || [],
      responsavel: {
        id: task.responsavel_id || '',
        nome: profile?.nome || task.assignee || 'Não atribuído',
        cargo: profile?.cargo || '',
        avatar: profile?.avatar_url || null,
      },
      responsavel_id: task.responsavel_id,
      project_id: task.project_id,
      sprint_id: task.sprint_id,
      user_id: task.user_id || '',
      canEdit: true,
      tempoEstimado: task.tempo_estimado || '',
      recurrenceType: task.recurrence_type || 'none',
      recurrenceEndDate: task.recurrence_end_date || '',
      recurrenceInstanceDate: task.due_date || '',
      observacoes: task.observacoes || '',
      progress: task.progress || 0,
    };
  };

  const handleTaskClick = (task: RealTask) => {
    setSelectedTask(convertToTaskFormat(task));
    setShowTaskModal(true);
  };

  const handleTaskModalClose = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
    loadData();
  };

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
    setShowTaskModal(false);
    setSelectedTask(null);
    loadData();
  };

  // ── Renderizar tarefa (com drag handle) ──
  const renderTask = (task: RealTask) => {
    const profile = task.responsavel_id ? memberProfiles.get(task.responsavel_id) : null;
    const done = isTaskDone(task.status);
    const isMoving = movingTaskId === task.id;

    return (
      <DraggableTask key={task.id} task={task}>
        {(dragHandleProps, isDragging) => (
          <div
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all ${
              isDragging
                ? 'opacity-40'
                : isMoving
                ? 'opacity-60 animate-pulse'
                : 'hover:bg-teal-50/60 dark:hover:bg-teal-900/10'
            }`}
          >
            {/* Drag handle */}
            <div
              {...dragHandleProps}
              className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-teal-500 dark:hover:text-teal-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
              title="Arrastar para outra sprint"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="ri-draggable text-base"></i>
            </div>

            {/* Status icon — clicável para abrir detalhes */}
            <div
              className="w-5 h-5 flex items-center justify-center flex-shrink-0 cursor-pointer"
              onClick={() => handleTaskClick(task)}
            >
              <i className={`${getTaskStatusIcon(task.status)} text-base`}></i>
            </div>

            {/* Info — clicável */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => handleTaskClick(task)}
            >
              <p className={`text-sm leading-snug ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${getTaskStatusStyle(task.status)}`}>
                  {getTaskStatusLabel(task.status)}
                </span>
                {task.priority && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <i className={`${getPriorityIcon(task.priority)} text-xs`}></i>
                    {getPriorityLabel(task.priority)}
                  </span>
                )}
                {task.due_date && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <i className="ri-calendar-line text-xs"></i>
                    {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                )}
                {task.categoria && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <i className="ri-price-tag-3-line text-xs"></i>
                    {task.categoria}
                  </span>
                )}
              </div>
            </div>

            {/* Responsável */}
            {(profile || task.assignee) && (
              <div
                className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                title={profile?.nome || task.assignee}
                onClick={() => handleTaskClick(task)}
              >
                <UserAvatar avatarUrl={profile?.avatar_url || ''} nome={profile?.nome || task.assignee || '?'} size="xs" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[80px] truncate hidden sm:inline">
                  {profile?.nome || task.assignee}
                </span>
              </div>
            )}

            {/* Seta indicando clicável */}
            <div
              className="w-4 h-4 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => handleTaskClick(task)}
            >
              <i className="ri-arrow-right-s-line text-teal-500 dark:text-teal-400 text-sm"></i>
            </div>
          </div>
        )}
      </DraggableTask>
    );
  };

  // ── Card de tarefa no overlay (enquanto arrasta) ──
  const renderDragOverlay = (task: RealTask) => {
    const profile = task.responsavel_id ? memberProfiles.get(task.responsavel_id) : null;
    const done = isTaskDone(task.status);
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-gray-800 shadow-2xl border border-teal-300 dark:border-teal-600 ring-2 ring-teal-200 dark:ring-teal-800 w-80 max-w-full">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <i className="ri-draggable text-gray-400 text-base"></i>
        </div>
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <i className={`${getTaskStatusIcon(task.status)} text-base`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug truncate ${done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${getTaskStatusStyle(task.status)}`}>
              {getTaskStatusLabel(task.status)}
            </span>
            {task.priority && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                <i className={`${getPriorityIcon(task.priority)} text-xs`}></i>
                {getPriorityLabel(task.priority)}
              </span>
            )}
          </div>
        </div>
        {(profile || task.assignee) && (
          <UserAvatar avatarUrl={profile?.avatar_url || ''} nome={profile?.nome || task.assignee || '?'} size="xs" />
        )}
      </div>
    );
  };

  // ── Renderizar sprint ──
  const renderSprint = (sprint: SprintData, index: number) => {
    const isExpanded = expandedSprints.has(sprint.id);
    const taskCount = sprint.tasks.length;
    const doneCount = sprint.tasks.filter((t) => isTaskDone(t.status)).length;
    const inProgressCount = sprint.tasks.filter((t) => isTaskInProgress(t.status)).length;
    const sprintProgress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
    const isQuickAddOpen = quickAddSprintId === sprint.id;
    const isDropTarget = overSprintId === sprint.id;

    return (
      <div
        key={sprint.id}
        className={`rounded-xl border overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200 ${
          isDropTarget
            ? 'border-teal-400 dark:border-teal-500 shadow-md shadow-teal-100 dark:shadow-teal-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:shadow-sm'
        }`}
      >
        {/* Sprint Header */}
        <div className="flex items-center gap-0 bg-gray-100 dark:bg-gray-700/50">
          <button
            onClick={() => toggleSprint(sprint.id)}
            className="flex-1 flex items-center gap-3 px-4 py-3.5 hover:bg-gray-150 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left"
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-400 dark:text-gray-500">
              <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-lg`}></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded">
                  #{index + 1}
                </span>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{sprint.name}</h4>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${getSprintStatusStyle(sprint.status)}`}>
                  {getSprintStatusLabel(sprint.status)}
                </span>
                {isDropTarget && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 animate-pulse">
                    <i className="ri-arrow-down-line text-xs"></i>
                    Soltar aqui
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {/* ✅ CORRIGIDO: Usar formatDateBR para evitar problema de timezone */}
                {(sprint.start_date || sprint.end_date) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <i className="ri-calendar-event-line text-xs"></i>
                    {sprint.start_date && sprint.end_date ? (
                      <>
                        {formatDateBR(sprint.start_date)}
                        {' → '}
                        {formatDateBR(sprint.end_date)}
                      </>
                    ) : sprint.end_date ? (
                      <>Entrega: {formatDateBR(sprint.end_date)}</>
                    ) : sprint.start_date ? (
                      <>Início: {formatDateBR(sprint.start_date)}</>
                    ) : null}
                  </span>
                )}
                {sprint.members.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <i className="ri-team-line text-xs"></i>
                    {sprint.members.length} membro{sprint.members.length !== 1 ? 's' : ''}
                  </span>
                )}
                {taskCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <i className="ri-task-line text-xs"></i>
                    {doneCount}/{taskCount} tarefa{taskCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            {taskCount > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${sprintProgress === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                    style={{ width: `${sprintProgress}%` }}
                  ></div>
                </div>
                <span className={`text-xs font-bold tabular-nums min-w-[32px] text-right ${sprintProgress === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {sprintProgress}%
                </span>
              </div>
            )}
          </button>

          {/* Botão adicionar tarefa rápida */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isExpanded) {
                setExpandedSprints((prev) => { const next = new Set(prev); next.add(sprint.id); return next; });
              }
              setQuickAddSprintId(isQuickAddOpen ? null : sprint.id);
            }}
            title="Adicionar tarefa nesta sprint"
            className={`flex-shrink-0 w-9 h-9 mx-2 flex items-center justify-center rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              isQuickAddOpen
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
            }`}
          >
            <i className={`${isQuickAddOpen ? 'ri-close-line' : 'ri-add-line'} text-base`}></i>
          </button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-gray-100 dark:border-gray-700/50">
            {sprint.members.length > 0 && (
              <div className="px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Equipe</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sprint.members.map((memberId, idx) => {
                      const profile = memberProfiles.get(memberId);
                      const displayName = profile?.nome || (memberId.length > 20 ? memberId.substring(0, 8) + '...' : memberId);
                      return (
                        <div key={`${sprint.id}-m-${idx}`} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md" title={profile?.nome || memberId}>
                          <UserAvatar avatarUrl={profile?.avatar_url || ''} nome={displayName} size="xs" />
                          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">{displayName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {taskCount > 0 && (
              <div className="px-4 py-2 flex items-center gap-4 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{doneCount} concluída{doneCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{inProgressCount} em andamento</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{taskCount - doneCount - inProgressCount} pendente{(taskCount - doneCount - inProgressCount) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}

            {isQuickAddOpen && (
              <div className="pt-2">
                <QuickAddTaskInSprint
                  projectId={project.id}
                  sprintId={sprint.id}
                  onTaskAdded={() => { setQuickAddSprintId(null); loadData(); }}
                  onCancel={() => setQuickAddSprintId(null)}
                />
              </div>
            )}

            {/* Zona de drop das tarefas */}
            <DroppableSprint sprintId={sprint.id} isOver={isDropTarget}>
              <div className="px-2 py-1.5">
                {taskCount > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                    {sprint.tasks.map(renderTask)}
                  </div>
                ) : (
                  <div className={`flex flex-col items-center justify-center py-6 rounded-lg ${isDropTarget ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''}`}>
                    <i className={`text-xl mb-1.5 ${isDropTarget ? 'ri-arrow-down-circle-line text-teal-500' : 'ri-inbox-line text-gray-400 dark:text-gray-500'}`}></i>
                    <p className={`text-xs ${isDropTarget ? 'text-teal-600 dark:text-teal-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                      {isDropTarget ? 'Solte aqui para mover' : 'Nenhuma tarefa nesta sprint'}
                    </p>
                    {!isQuickAddOpen && !isDropTarget && (
                      <button
                        onClick={() => setQuickAddSprintId(sprint.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium cursor-pointer transition-colors"
                      >
                        <i className="ri-add-line text-sm"></i>
                        Adicionar primeira tarefa
                      </button>
                    )}
                  </div>
                )}
              </div>
            </DroppableSprint>
          </div>
        )}

        {/* Drop zone visível mesmo quando recolhida */}
        {!isExpanded && (
          <DroppableSprint sprintId={sprint.id} isOver={isDropTarget}>
            {isDropTarget ? (
              <div className="flex items-center justify-center gap-2 py-3 text-teal-600 dark:text-teal-400 text-xs font-medium bg-teal-50/60 dark:bg-teal-900/10 border-t border-teal-100 dark:border-teal-800/30">
                <i className="ri-arrow-down-circle-line text-base"></i>
                Solte aqui para mover para esta sprint
              </div>
            ) : (
              <div className="h-0" />
            )}
          </DroppableSprint>
        )}
      </div>
    );
  };

  // ── Vincular tarefas órfãs às sprints selecionadas ──
  const handleLinkOrphanTasks = async () => {
    const toLink = Object.entries(linkSelections).filter(([, sprintId]) => sprintId !== '');
    if (toLink.length === 0) {
      return;
    }

    setLinkingTasks(true);
    try {
      await Promise.all(
        toLink.map(([taskId, sprintId]) =>
          supabase.from('tasks').update({ sprint_id: sprintId }).eq('id', taskId)
        )
      );
      setLinkSuccess(`${toLink.length} tarefa${toLink.length > 1 ? 's vinculadas' : ' vinculada'} com sucesso!`);
      setTimeout(() => setLinkSuccess(null), 4000);
      setShowLinkPanel(false);
      loadData();
    } catch {
      // silencioso — loadData vai reverter
    } finally {
      setLinkingTasks(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* ── Banner: tarefas do projeto sem sprint ── */}
        {orphanTasks.length > 0 && sprintsData.length > 0 && !showLinkPanel && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 flex-shrink-0">
              <i className="ri-alert-line text-amber-600 dark:text-amber-400 text-base"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {orphanTasks.length} tarefa{orphanTasks.length > 1 ? 's' : ''} sem sprint
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Este projeto tem tarefas que ainda não foram vinculadas a nenhuma sprint. Vincule-as para organizar o planejamento.
              </p>
            </div>
            <button
              onClick={() => setShowLinkPanel(true)}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-links-line text-sm"></i>
              Vincular às Sprints
            </button>
          </div>
        )}

        {/* ── Painel de vinculação em massa ── */}
        {showLinkPanel && orphanTasks.length > 0 && sprintsData.length > 0 && (
          <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 overflow-hidden">
            {/* Header do painel */}
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-100/80 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
              <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-200 dark:bg-amber-800 flex-shrink-0">
                <i className="ri-links-line text-amber-700 dark:text-amber-300 text-sm"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Vincular Tarefas às Sprints
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Selecione a sprint para cada tarefa e clique em "Confirmar Vínculos"
                </p>
              </div>
              <button
                onClick={() => setShowLinkPanel(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line text-base"></i>
              </button>
            </div>

            {/* Lista de tarefas com seletor de sprint */}
            <div className="divide-y divide-amber-100 dark:divide-amber-800/40">
              {orphanTasks.map((task) => {
                const profile = task.responsavel_id ? memberProfiles.get(task.responsavel_id) : null;
                const selectedSprintName = linkSelections[task.id]
                  ? sprintsData.find((s) => s.id === linkSelections[task.id])?.name
                  : null;

                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors">
                    {/* Ícone status */}
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className={`${getTaskStatusIcon(task.status)} text-base`}></i>
                    </div>

                    {/* Info da tarefa */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${getTaskStatusStyle(task.status)}`}>
                          {getTaskStatusLabel(task.status)}
                        </span>
                        {task.priority && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                            <i className={`${getPriorityIcon(task.priority)} text-xs`}></i>
                            {getPriorityLabel(task.priority)}
                          </span>
                        )}
                        {(profile || task.assignee) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                            <UserAvatar avatarUrl={profile?.avatar_url || ''} nome={profile?.nome || task.assignee || '?'} size="xs" />
                            {profile?.nome || task.assignee}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Seletor de sprint */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {linkSelections[task.id] ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 max-w-[140px] truncate">
                          <i className="ri-flashlight-line text-xs flex-shrink-0"></i>
                          <span className="truncate">{selectedSprintName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          <i className="ri-question-line text-xs"></i>
                          Sem sprint
                        </span>
                      )}
                      <select
                        value={linkSelections[task.id] || ''}
                        onChange={(e) =>
                          setLinkSelections((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        className="px-2 py-1.5 text-xs border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent cursor-pointer appearance-none pr-6 max-w-[160px]"
                        style={{
                          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 6px center',
                        }}
                      >
                        <option value="">— Selecionar sprint —</option>
                        {sprintsData.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé do painel */}
            <div className="flex items-center justify-between px-4 py-3 bg-amber-100/60 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {Object.values(linkSelections).filter((v) => v !== '').length} de {orphanTasks.length} tarefa{orphanTasks.length > 1 ? 's' : ''} selecionada{Object.values(linkSelections).filter((v) => v !== '').length !== 1 ? 's' : ''}
                </span>
                {Object.values(linkSelections).filter((v) => v !== '').length < orphanTasks.length && sprintsData.length > 0 && (
                  <button
                    onClick={() => {
                      const firstSprint = sprintsData[0];
                      if (!firstSprint) return;
                      const allSelected: Record<string, string> = {};
                      orphanTasks.forEach((t) => {
                        allSelected[t.id] = linkSelections[t.id] || firstSprint.id;
                      });
                      setLinkSelections(allSelected);
                    }}
                    className="text-xs text-amber-700 dark:text-amber-400 underline cursor-pointer hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                  >
                    Selecionar todas para a 1ª sprint
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLinkPanel(false)}
                  disabled={linkingTasks}
                  className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-amber-200 dark:hover:bg-amber-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLinkOrphanTasks}
                  disabled={linkingTasks || Object.values(linkSelections).filter((v) => v !== '').length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {linkingTasks ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-sm"></i>
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-double-line text-sm"></i>
                      Confirmar Vínculos
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast de sucesso de vinculação */}
        {linkSuccess && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-sm"></i>
            </div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{linkSuccess}</p>
          </div>
        )}

        {/* Dica de drag and drop */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800/50 rounded-lg">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className="ri-drag-move-2-line text-teal-500 dark:text-teal-400 text-sm"></i>
            </div>
            <p className="text-[11px] text-teal-700 dark:text-teal-400">
              Passe o mouse sobre uma tarefa e arraste o ícone <i className="ri-draggable"></i> para movê-la entre sprints
            </p>
          </div>
        )}

        {/* Toast de sucesso de mover */}
        {moveSuccess && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg animate-pulse">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <i className="ri-checkbox-circle-fill text-emerald-500 text-sm"></i>
            </div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{moveSuccess}</p>
          </div>
        )}

        {/* Resumo global */}
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-flashlight-line text-teal-600 dark:text-teal-400"></i>
                </div>
                <span className="font-semibold">{totalSprints}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{totalSprints === 1 ? 'Sprint' : 'Sprints'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-task-line text-teal-600 dark:text-teal-400"></i>
                </div>
                <span className="font-semibold">{totalTasks}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Tarefas</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-checkbox-circle-line text-emerald-600 dark:text-emerald-400"></i>
                </div>
                <span className="font-semibold">{totalDone}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Concluídas</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-loader-4-line text-blue-600 dark:text-blue-400"></i>
                </div>
                <span className="font-semibold">{totalInProgress}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">Em Andamento</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={expandAll} className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-200/60 dark:hover:bg-gray-600/40 rounded-md transition-colors cursor-pointer" title="Expandir todas">
                <i className="ri-expand-diagonal-line text-sm"></i>
              </button>
              <button onClick={collapseAll} className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-200/60 dark:hover:bg-gray-600/40 rounded-md transition-colors cursor-pointer" title="Recolher todas">
                <i className="ri-collapse-diagonal-line text-sm"></i>
              </button>
            </div>
          </div>
          {totalTasks > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${globalProgress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${globalProgress}%` }}
                ></div>
              </div>
              <span className={`text-sm font-bold tabular-nums ${globalProgress === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {globalProgress}%
              </span>
            </div>
          )}
        </div>

        {/* Lista de sprints */}
        <div className="space-y-3">
          {sprintsData.map((sprint, index) => renderSprint(sprint, index))}
        </div>

        {/* Tarefas sem sprint */}
        {(orphanTasks.length > 0 || overSprintId === 'orphan') && (
          <div className={`rounded-xl border overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200 ${
            overSprintId === 'orphan'
              ? 'border-amber-400 dark:border-amber-500 shadow-md shadow-amber-100 dark:shadow-amber-900/30 border-dashed'
              : 'border-dashed border-gray-300 dark:border-gray-600'
          }`}>
            <button
              onClick={() => toggleSprint('orphan')}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer text-left"
            >
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-400 dark:text-gray-500">
                <i className={`ri-arrow-${expandedSprints.has('orphan') ? 'down' : 'right'}-s-line text-lg`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <i className="ri-folder-unknow-line text-amber-500 dark:text-amber-400"></i>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tarefas sem Sprint</h4>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                    Não atribuídas
                  </span>
                  {overSprintId === 'orphan' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
                      <i className="ri-arrow-down-line text-xs"></i>
                      Soltar aqui
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {orphanTasks.filter((t) => isTaskDone(t.status)).length}/{orphanTasks.length} tarefa{orphanTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </button>

            <DroppableSprint sprintId="orphan" isOver={overSprintId === 'orphan'}>
              {expandedSprints.has('orphan') ? (
                <div className="border-t border-gray-100 dark:border-gray-700/40 px-2 py-1.5">
                  {orphanTasks.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                      {orphanTasks.map(renderTask)}
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center py-6 rounded-lg ${overSprintId === 'orphan' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <i className={`text-xl mb-1.5 ${overSprintId === 'orphan' ? 'ri-arrow-down-circle-line text-amber-500' : 'ri-inbox-line text-gray-400 dark:text-gray-500'}`}></i>
                      <p className={`text-xs ${overSprintId === 'orphan' ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                        {overSprintId === 'orphan' ? 'Solte aqui para remover da sprint' : 'Nenhuma tarefa sem sprint'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                overSprintId === 'orphan' ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-amber-600 dark:text-amber-400 text-xs font-medium bg-amber-50/60 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-800/30">
                    <i className="ri-arrow-down-circle-line text-base"></i>
                    Solte aqui para remover da sprint
                  </div>
                ) : (
                  <div className="h-0" />
                )
              )}
            </DroppableSprint>
          </div>
        )}
      </div>

      {/* Overlay enquanto arrasta */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeTask ? renderDragOverlay(activeTask) : null}
      </DragOverlay>

      {/* Modal de detalhes da tarefa */}
      {showTaskModal && selectedTask && (
        <TaskFormModal
          isOpen={showTaskModal}
          onClose={handleTaskModalClose}
          taskToEdit={selectedTask}
          onDelete={handleDeleteTask}
          initialTab="detalhes"
        />
      )}
    </DndContext>
  );
}
