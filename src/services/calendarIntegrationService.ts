import { supabase } from '../lib/supabaseClient';
import { generateRecurrenceInstances, CalendarEvent } from './calendarService';
import { safeFetchMany, parseDate } from './supabaseHelpers';

/**
 * Converte "YYYY-MM-DD" em Date local, sem conversão UTC.
 */
function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formata Date para "YYYY-MM-DD" usando valores locais.
 */
function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type CalendarItemSource = 'event' | 'task' | 'project' | 'sprint';

export interface CalendarItem {
  id: string;
  title: string;
  type: string;
  source: CalendarItemSource;
  event_date: string;
  event_time: string;
  duration: string | null;
  location: string | null;
  description: string | null;
  attendees: string | null;
  reminder: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  // Recurrence fields
  recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_end_date?: string | null;
  recurrence_parent_id?: string | null;
  // Extra metadata
  meta?: {
    status?: string;
    priority?: string;
    progress?: number;
    projectName?: string;
    projectId?: string;
    sprintName?: string;
    assignee?: string;
    tags?: string[];
    categoria?: string;
    projectColor?: string;
    dateType?: string; // 'due_date' | 'deadline' | 'start' | 'sprint_end'
  };
  isReadOnly: boolean; // tasks/projects cannot be deleted from calendar
}

const taskPriorityColors: Record<string, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-500',
  baixa: 'bg-emerald-500',
  urgente: 'bg-rose-600',
};

const projectPriorityColors: Record<string, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-500',
  baixa: 'bg-emerald-500',
  urgente: 'bg-rose-600',
  critica: 'bg-rose-600',
};

/**
 * Gera instâncias virtuais de tarefas recorrentes
 */
function generateTaskRecurrenceInstances(
  task: any,
  startDate: string,
  endDate: string
): any[] {
  if (!task.recurrence_type || task.recurrence_type === 'none') {
    return [task];
  }

  const instances: any[] = [];
  const start = parseDateLocal(startDate);
  const end = parseDateLocal(endDate);
  const recurrenceEnd = task.recurrence_end_date
    ? parseDateLocal(task.recurrence_end_date)
    : null;

  let currentDate = parseDateLocal(task.due_date);

  let count = 0;
  const maxInstances = 365;

  while (currentDate <= end && count < maxInstances) {
    if (currentDate >= start && currentDate <= end) {
      if (!recurrenceEnd || currentDate <= recurrenceEnd) {
        const instanceDate = formatDateLocal(currentDate);

        instances.push({
          ...task,
          id: `${task.id}_recur_${instanceDate}`,
          due_date: instanceDate,
          recurrence_parent_id: task.id,
        });
      }
    }

    switch (task.recurrence_type) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }

    count++;
  }

  return instances;
}

/**
 * Busca todos os itens do calendário com tratamento de erro individual
 * REFATORADO: Cada fonte de dados tem try/catch próprio para não quebrar o calendário inteiro
 * CORRIGIDO: Expandido para incluir tarefas de projetos compartilhados
 */
export async function fetchAllCalendarItems(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarItem[]> {
  const items: CalendarItem[] = [];

  // GUARD: Validar userId
  if (!userId) {
    console.warn('[CALENDAR] userId inválido, retornando array vazio');
    return [];
  }

  // 1. Fetch calendar events (including recurrent ones)
  try {
    const events = await safeFetchMany(() =>
      supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })
    );

    if (events && events.length > 0) {
      // Expandir eventos recorrentes
      events.forEach((ev: any) => {
        try {
          const expandedEvents = generateRecurrenceInstances(
            ev as CalendarEvent,
            startDate,
            endDate
          );

          expandedEvents.forEach((expandedEv) => {
            // Apenas adicionar se estiver dentro do range
            if (expandedEv.event_date >= startDate && expandedEv.event_date <= endDate) {
              items.push({
                id: expandedEv.id,
                title: expandedEv.title,
                type: expandedEv.type || 'meeting',
                source: 'event',
                event_date: expandedEv.event_date,
                event_time: expandedEv.event_time || '00:00',
                duration: expandedEv.duration,
                location: expandedEv.location,
                description: expandedEv.description,
                attendees: expandedEv.attendees,
                reminder: expandedEv.reminder,
                color: expandedEv.color || 'bg-teal-500',
                recurrence_type: expandedEv.recurrence_type,
                recurrence_end_date: expandedEv.recurrence_end_date,
                recurrence_parent_id: expandedEv.recurrence_parent_id,
                created_at: expandedEv.created_at,
                updated_at: expandedEv.updated_at || expandedEv.created_at,
                isReadOnly: false,
              });
            }
          });
        } catch (err) {
          console.warn('[CALENDAR] Erro ao expandir evento recorrente:', err);
        }
      });
    }
  } catch (err) {
    console.error('[CALENDAR] Erro ao buscar eventos (continuando):', err);
  }

  // 2. Fetch tasks with due_date (including recurrent ones)
  // CORRIGIDO: Buscar tarefas próprias + tarefas de projetos compartilhados
  try {
    // Buscar IDs dos projetos onde o usuário é membro
    let sharedProjectIds: string[] = [];
    try {
      const projectMemberships = await safeFetchMany(() =>
        supabase
          .from('project_members')
          .select('project_id')
          .eq('profile_id', userId)
      );
      sharedProjectIds = projectMemberships.map((pm: any) => pm.project_id);
    } catch (err) {
      console.warn('[CALENDAR] Erro ao buscar projetos compartilhados (continuando):', err);
    }

    // Buscar tarefas próprias
    const ownTasks = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true })
    );

    // Buscar tarefas de projetos compartilhados (se houver)
    let sharedTasks: any[] = [];
    if (sharedProjectIds.length > 0) {
      try {
        sharedTasks = await safeFetchMany(() =>
          supabase
            .from('tasks')
            .select('*')
            .in('project_id', sharedProjectIds)
            .neq('user_id', userId) // Evitar duplicatas
            .order('due_date', { ascending: true })
        );
      } catch (err) {
        console.warn('[CALENDAR] Erro ao buscar tarefas compartilhadas (continuando):', err);
      }
    }

    // Buscar tarefas onde o usuário é responsável
    let assignedTasks: any[] = [];
    try {
      assignedTasks = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('*')
          .eq('responsavel_id', userId)
          .neq('user_id', userId) // Evitar duplicatas
          .order('due_date', { ascending: true })
      );
    } catch (err) {
      console.warn('[CALENDAR] Erro ao buscar tarefas atribuídas (continuando):', err);
    }

    // Combinar todas as tarefas e remover duplicatas
    const allTasksMap = new Map();
    [...ownTasks, ...sharedTasks, ...assignedTasks].forEach((task: any) => {
      if (!allTasksMap.has(task.id)) {
        allTasksMap.set(task.id, task);
      }
    });
    const tasks = Array.from(allTasksMap.values());

    // Fetch project names for tasks
    const projectIds = [...new Set(tasks.filter((t: any) => t.project_id).map((t: any) => t.project_id))];
    let projectMap: Record<string, { nome: string; cor: string }> = {};
    
    if (projectIds.length > 0) {
      try {
        const projects = await safeFetchMany(() =>
          supabase
            .from('projects')
            .select('id, nome, cor')
            .in('id', projectIds)
        );

        projects.forEach((p: any) => {
          projectMap[p.id] = { nome: p.nome, cor: p.cor };
        });
      } catch (err) {
        console.warn('[CALENDAR] Erro ao buscar nomes de projetos (continuando):', err);
      }
    }

    if (tasks && tasks.length > 0) {
      // Expandir tarefas recorrentes
      tasks.forEach((task: any) => {
        try {
          const expandedTasks = generateTaskRecurrenceInstances(task, startDate, endDate);

          expandedTasks.forEach((expandedTask) => {
            const proj = expandedTask.project_id ? projectMap[expandedTask.project_id] : null;
            items.push({
              id: `task-${expandedTask.id}`,
              title: expandedTask.title,
              type: 'task',
              source: 'task',
              event_date: expandedTask.due_date,
              event_time: '09:00',
              duration: expandedTask.tempo_estimado || null,
              location: null,
              description: expandedTask.description,
              attendees: expandedTask.assignee || null,
              reminder: null,
              color: taskPriorityColors[expandedTask.priority] || 'bg-sky-500',
              recurrence_type: expandedTask.recurrence_type || 'none',
              recurrence_end_date: expandedTask.recurrence_end_date,
              recurrence_parent_id: expandedTask.recurrence_parent_id,
              created_at: expandedTask.created_at,
              updated_at: expandedTask.updated_at || expandedTask.created_at,
              isReadOnly: false,
              meta: {
                status: expandedTask.status,
                priority: expandedTask.priority,
                progress: expandedTask.progress,
                projectName: proj?.nome,
                projectId: expandedTask.project_id,
                projectColor: proj?.cor,
                assignee: expandedTask.assignee,
                tags: expandedTask.tags,
                categoria: expandedTask.categoria,
                dateType: 'due_date',
              },
            });
          });
        } catch (err) {
          console.warn('[CALENDAR] Erro ao expandir tarefa recorrente:', err);
        }
      });
    }
  } catch (err) {
    console.error('[CALENDAR] Erro ao buscar tarefas (continuando):', err);
  }

  // 3. Fetch projects with dates in range
  // CORRIGIDO: Buscar projetos próprios + projetos compartilhados
  try {
    // Buscar projetos próprios
    const ownProjects = await safeFetchMany(() =>
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
    );

    // Buscar IDs dos projetos compartilhados
    let sharedProjectIds: string[] = [];
    try {
      const projectMemberships = await safeFetchMany(() =>
        supabase
          .from('project_members')
          .select('project_id')
          .eq('profile_id', userId)
      );
      sharedProjectIds = projectMemberships.map((pm: any) => pm.project_id);
    } catch (err) {
      console.warn('[CALENDAR] Erro ao buscar membros de projetos (continuando):', err);
    }

    // Buscar projetos compartilhados
    let sharedProjects: any[] = [];
    if (sharedProjectIds.length > 0) {
      try {
        sharedProjects = await safeFetchMany(() =>
          supabase
            .from('projects')
            .select('*')
            .in('id', sharedProjectIds)
            .neq('user_id', userId) // Evitar duplicatas
        );
      } catch (err) {
        console.warn('[CALENDAR] Erro ao buscar projetos compartilhados (continuando):', err);
      }
    }

    // Combinar projetos e remover duplicatas
    const allProjectsMap = new Map();
    [...ownProjects, ...sharedProjects].forEach((proj: any) => {
      if (!allProjectsMap.has(proj.id)) {
        allProjectsMap.set(proj.id, proj);
      }
    });
    const allProjects = Array.from(allProjectsMap.values());

    if (allProjects && allProjects.length > 0) {
      allProjects.forEach((proj: any) => {
        try {
          // Project start date
          const startParsed = parseDate(proj.data_inicio);
          if (startParsed && startParsed >= startDate && startParsed <= endDate) {
            items.push({
              id: `proj-start-${proj.id}`,
              title: `${proj.nome} — Início`,
              type: 'project_start',
              source: 'project',
              event_date: startParsed,
              event_time: '08:00',
              duration: null,
              location: null,
              description: proj.descricao || null,
              attendees: null,
              reminder: null,
              color: proj.cor || 'bg-indigo-500',
              created_at: proj.created_at,
              updated_at: proj.updated_at || proj.created_at,
              isReadOnly: false,
              meta: {
                status: proj.status,
                priority: proj.prioridade,
                progress: proj.progresso,
                projectName: proj.nome,
                projectId: proj.id,
                projectColor: proj.cor,
                dateType: 'start',
              },
            });
          }

          // Project deadline
          const deadlineParsed = parseDate(proj.deadline);
          if (deadlineParsed && deadlineParsed >= startDate && deadlineParsed <= endDate) {
            items.push({
              id: `proj-deadline-${proj.id}`,
              title: `${proj.nome} — Deadline`,
              type: 'project_deadline',
              source: 'project',
              event_date: deadlineParsed,
              event_time: '18:00',
              duration: null,
              location: null,
              description: proj.descricao || null,
              attendees: null,
              reminder: null,
              color: 'bg-red-500',
              created_at: proj.created_at,
              updated_at: proj.updated_at || proj.created_at,
              isReadOnly: false,
              meta: {
                status: proj.status,
                priority: proj.prioridade,
                progress: proj.progresso,
                projectName: proj.nome,
                projectId: proj.id,
                projectColor: proj.cor,
                dateType: 'deadline',
              },
            });
          }

          // Project prazo (if different from deadline)
          const prazoParsed = parseDate(proj.prazo);
          if (prazoParsed && prazoParsed !== deadlineParsed && prazoParsed >= startDate && prazoParsed <= endDate) {
            items.push({
              id: `proj-prazo-${proj.id}`,
              title: `${proj.nome} — Prazo`,
              type: 'project_deadline',
              source: 'project',
              event_date: prazoParsed,
              event_time: '17:00',
              duration: null,
              location: null,
              description: proj.descricao || null,
              attendees: null,
              reminder: null,
              color: 'bg-orange-500',
              created_at: proj.created_at,
              updated_at: proj.updated_at || proj.created_at,
              isReadOnly: false,
              meta: {
                status: proj.status,
                priority: proj.prioridade,
                progress: proj.progresso,
                projectName: proj.nome,
                projectId: proj.id,
                projectColor: proj.cor,
                dateType: 'deadline',
              },
            });
          }
        } catch (err) {
          console.warn('[CALENDAR] Erro ao processar projeto:', err);
        }
      });

      // 4. Fetch sprints with end_date in range
      try {
        const userProjectIds = allProjects.map((p: any) => p.id);
        if (userProjectIds.length > 0) {
          const sprints = await safeFetchMany(() =>
            supabase
              .from('project_sprints')
              .select('*')
              .in('project_id', userProjectIds)
          );

          if (sprints && sprints.length > 0) {
            sprints.forEach((sprint: any) => {
              try {
                const endParsed = parseDate(sprint.end_date);
                if (endParsed && endParsed >= startDate && endParsed <= endDate) {
                  const proj = allProjects.find((p: any) => p.id === sprint.project_id);
                  items.push({
                    id: `sprint-${sprint.id}`,
                    title: `Sprint: ${sprint.name}`,
                    type: 'sprint_end',
                    source: 'sprint',
                    event_date: endParsed,
                    event_time: '17:00',
                    duration: null,
                    location: null,
                    description: `Sprint do projeto ${proj?.nome || ''}`,
                    attendees: sprint.members ? sprint.members.join(', ') : null,
                    reminder: null,
                    color: 'bg-violet-500',
                    created_at: sprint.created_at,
                    updated_at: sprint.created_at,
                    isReadOnly: false,
                    meta: {
                      status: sprint.status,
                      projectName: proj?.nome,
                      projectId: sprint.project_id,
                      projectColor: proj?.cor,
                      dateType: 'sprint_end',
                      sprintName: sprint.name,
                    },
                  });
                }
              } catch (err) {
                console.warn('[CALENDAR] Erro ao processar sprint:', err);
              }
            });
          }
        }
      } catch (err) {
        console.error('[CALENDAR] Erro ao buscar sprints (continuando):', err);
      }
    }
  } catch (err) {
    console.error('[CALENDAR] Erro ao buscar projetos (continuando):', err);
  }

  // Sort all items by date and time
  items.sort((a, b) => {
    const dateCompare = a.event_date.localeCompare(b.event_date);
    if (dateCompare !== 0) return dateCompare;
    return (a.event_time || '00:00').localeCompare(b.event_time || '00:00');
  });

  return items;
}

export async function fetchAllCalendarItemsForMonth(
  userId: string,
  year: number,
  month: number
): Promise<CalendarItem[]> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return fetchAllCalendarItems(userId, startDate, endDate);
}
