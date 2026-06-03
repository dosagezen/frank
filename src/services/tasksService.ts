import { supabase } from '../lib/supabaseClient';
import { safeFetchMany } from './supabaseHelpers';
import { getCached, setCached, CACHE_KEYS } from './localCache';
import { invalidateTaskCaches } from './realtimeSyncService';

export interface TaskResponsavel {
  id: string;
  nome: string;
  cargo: string;
  avatar: string | null;
}

export interface TaskProject {
  id: string;
  nome: string;
  user_id: string;
}

export interface Task {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  prazo: string;
  categoria: string;
  tags: string[];
  responsavel: TaskResponsavel;
  project_id: string | null;
  project?: TaskProject;
  user_id: string;
  canEdit?: boolean;
  tempoEstimado?: string;
  recurrenceType?: string;
  recurrenceEndDate?: string;
  recurrenceInstanceDate?: string;
  observacoes?: string;
  sprint_id?: string;
  progress?: number;
  links?: { id: string; title: string; url: string }[];
  subtaskStats?: {
    total: number;
    completed: number;
  };
  position?: number | null;
  created_at?: string;
}

export interface ProjectOption {
  id: string;
  nome: string;
}

/**
 * ✅ OTIMIZADO: Busca todas as tarefas com UMA ÚNICA QUERY usando JOINs
 * Reduz drasticamente o número de requisições ao banco
 */
export async function fetchTasks(): Promise<Task[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return [];
    }

    // Verificar se é admin (com cache)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profileData?.role === 'admin';

    // ✅ UMA ÚNICA QUERY com todos os relacionamentos + position e created_at
    const [tasksResult, subtasksResult, memberProjectsResult] = await Promise.all([
      supabase
        .from('tasks')
        .select(`
          *,
          project:projects(id, nome, user_id),
          responsavel:profiles!tasks_responsavel_id_fkey(id, nome, cargo, avatar_url)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('task_subtasks')
        .select('task_id, concluida'),
      supabase
        .from('project_members')
        .select('project_id')
        .eq('profile_id', user.id),
    ]);

    const { data: tasksData, error: tasksError } = tasksResult;

    if (tasksError) {
      console.error('[TASKS SERVICE] Erro ao buscar tarefas:', tasksError);
      throw tasksError;
    }

    if (!tasksData || tasksData.length === 0) {
      return [];
    }

    // Montar mapa de subtarefas por task_id
    const subtasksMap = new Map<string, { total: number; completed: number }>();
    if (subtasksResult.data) {
      for (const sub of subtasksResult.data) {
        const existing = subtasksMap.get(sub.task_id) || { total: 0, completed: 0 };
        existing.total += 1;
        if (sub.concluida) existing.completed += 1;
        subtasksMap.set(sub.task_id, existing);
      }
    }

    const memberProjectIds = new Set(memberProjectsResult.data?.map(mp => mp.project_id) || []);

    // ✅ Processar tarefas localmente (muito mais rápido)
    const processedTasks: Task[] = tasksData.map(task => {
      const profile = task.responsavel;

      // Determinar permissões
      let canEdit = false;
      if (isAdmin) {
        canEdit = true;
      } else if (task.user_id === user.id) {
        // Criador da tarefa sempre pode editar
        canEdit = true;
      } else if (task.responsavel_id === user.id) {
        // Responsável pela tarefa sempre pode editar (status, prioridade, prazo, etc.)
        canEdit = true;
      } else if (task.project_id) {
        const project = task.project;
        if (project?.user_id === user.id) {
          canEdit = true;
        } else if (memberProjectIds.has(task.project_id)) {
          canEdit = true;
        }
      }

      return {
        id: task.id,
        titulo: task.title,
        descricao: task.description || '',
        status: task.status,
        prioridade: task.priority,
        prazo: task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : 'Sem prazo',
        categoria: task.categoria || 'Sem categoria',
        tags: task.tags || [],
        responsavel: {
          id: task.responsavel_id,
          nome: profile?.nome || task.assignee || 'Nao atribuido',
          cargo: profile?.cargo || '',
          avatar: profile?.avatar_url || null,
        },
        project_id: task.project_id,
        project: task.project,
        user_id: task.user_id,
        canEdit,
        tempoEstimado: task.tempo_estimado,
        recurrenceType: task.recurrence_type,
        recurrenceEndDate: task.recurrence_end_date,
        recurrenceInstanceDate: task.due_date,
        observacoes: task.observacoes || '',
        sprint_id: task.sprint_id,
        progress: task.progress,
        links: task.links || [],
        subtaskStats: subtasksMap.get(task.id) || undefined,
        position: task.position ?? null,
        created_at: task.created_at,
      };
    });

    // ✅ Ordenar tarefas dentro de cada sprint por position (ASC), fallback para created_at
    const tasksBySprint = new Map<string, Task[]>();
    const tasksWithoutSprint: Task[] = [];

    processedTasks.forEach(task => {
      if (task.sprint_id) {
        const sprintTasks = tasksBySprint.get(task.sprint_id) || [];
        sprintTasks.push(task);
        tasksBySprint.set(task.sprint_id, sprintTasks);
      } else {
        tasksWithoutSprint.push(task);
      }
    });

    // Ordenar tarefas dentro de cada sprint
    tasksBySprint.forEach((tasks, sprintId) => {
      tasks.sort((a, b) => {
        // Se ambos têm position, ordenar por position
        if (a.position !== null && b.position !== null) {
          return a.position - b.position;
        }
        // Se apenas um tem position, ele vem primeiro
        if (a.position !== null) return -1;
        if (b.position !== null) return 1;
        // Se nenhum tem position, ordenar por created_at (mais recente primeiro)
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
      tasksBySprint.set(sprintId, tasks);
    });

    // Reconstruir array final mantendo a ordem
    const sortedTasks: Task[] = [];
    
    // Adicionar tarefas de sprints (já ordenadas)
    tasksBySprint.forEach(tasks => {
      sortedTasks.push(...tasks);
    });
    
    // Adicionar tarefas sem sprint
    sortedTasks.push(...tasksWithoutSprint);

    return sortedTasks;
  } catch (error) {
    console.error('[TASKS SERVICE] Erro fatal:', error);
    return [];
  }
}

/**
 * Busca projetos para o filtro de tarefas
 */
export async function fetchTaskProjectOptions(): Promise<ProjectOption[]> {
  try {
    const data = await safeFetchMany(async () =>
      supabase
        .from('projects')
        .select('id, nome')
        .order('nome', { ascending: true }),
      { cache: true, cacheKey: 'task_project_options' }
    );
    return data || [];
  } catch (error) {
    console.error('[TASKS] Erro ao carregar projetos:', error);
    return [];
  }
}

/**
 * Invalida caches de tarefas (chamar após criar/editar/excluir)
 */
export async function onTaskChanged(): Promise<void> {
  try {
    await invalidateTaskCaches();
  } catch (error) {
    console.error('[TASKS] Erro ao invalidar caches:', error);
  }
}
