
import { supabase } from '../lib/supabaseClient';

export type SearchResultType = 'tarefa' | 'projeto' | 'sprint' | 'evento' | 'conhecimento' | 'membro';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  path: string;
  icon: string;
  iconBg: string;
}

const TYPE_CONFIG: Record<SearchResultType, { icon: string; iconBg: string; label: string }> = {
  tarefa:      { icon: 'ri-task-line',           iconBg: 'bg-teal-500/10 text-teal-500',    label: 'Tarefa' },
  projeto:     { icon: 'ri-folder-line',          iconBg: 'bg-amber-500/10 text-amber-500',  label: 'Projeto' },
  sprint:      { icon: 'ri-sprint-line',          iconBg: 'bg-orange-500/10 text-orange-500',label: 'Sprint' },
  evento:      { icon: 'ri-calendar-event-line',  iconBg: 'bg-rose-500/10 text-rose-500',    label: 'Evento' },
  conhecimento:{ icon: 'ri-book-open-line',       iconBg: 'bg-cyan-500/10 text-cyan-500',    label: 'Conhecimento' },
  membro:      { icon: 'ri-user-line',            iconBg: 'bg-violet-500/10 text-violet-500',label: 'Membro' },
};

function makeResult(
  type: SearchResultType,
  id: string | number,
  title: string,
  path: string,
  subtitle?: string,
  badge?: string,
  badgeColor?: string,
): SearchResult {
  const cfg = TYPE_CONFIG[type];
  return {
    id: String(id),
    type,
    title,
    subtitle,
    badge,
    badgeColor,
    path,
    icon: cfg.icon,
    iconBg: cfg.iconBg,
  };
}

const STATUS_COLORS: Record<string, string> = {
  'pendente':       'bg-yellow-100 text-yellow-700',
  'em-andamento':   'bg-blue-100 text-blue-700',
  'em_andamento':   'bg-blue-100 text-blue-700',
  'concluida':      'bg-green-100 text-green-700',
  'concluido':      'bg-green-100 text-green-700',
  'feito':          'bg-green-100 text-green-700',
  'nao-iniciado':   'bg-gray-100 text-gray-600',
  'parado':         'bg-red-100 text-red-700',
  'revisao':        'bg-orange-100 text-orange-700',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    'pendente': 'Pendente',
    'em-andamento': 'Em andamento',
    'em_andamento': 'Em andamento',
    'concluida': 'Concluída',
    'concluido': 'Concluído',
    'feito': 'Feito',
    'nao-iniciado': 'Não iniciado',
    'parado': 'Parado',
    'revisao': 'Revisão',
  };
  return map[status?.toLowerCase()] ?? status;
}

export async function globalSearch(query: string, userId: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim().toLowerCase();

  const [
    tasksRes,
    projectsRes,
    sprintsRes,
    eventsRes,
    knowledgeRes,
    membersRes,
  ] = await Promise.allSettled([
    supabase
      .from('tasks')
      .select('id, title, status, priority, project_id, projects(nome)')
      .ilike('title', `%${q}%`)
      .limit(5),

    supabase
      .from('projects')
      .select('id, nome, status, prioridade')
      .ilike('nome', `%${q}%`)
      .limit(5),

    supabase
      .from('project_sprints')
      .select('id, name, status, project_id, projects(nome)')
      .ilike('name', `%${q}%`)
      .limit(5),

    supabase
      .from('calendar_events')
      .select('id, title, type, event_date, event_time')
      .eq('user_id', userId)
      .ilike('title', `%${q}%`)
      .limit(5),

    supabase
      .from('knowledge_base')
      .select('id, titulo, autor, tags')
      .ilike('titulo', `%${q}%`)
      .limit(5),

    supabase
      .from('profiles')
      .select('id, nome, cargo, departamento')
      .ilike('nome', `%${q}%`)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  // Tarefas
  if (tasksRes.status === 'fulfilled' && tasksRes.value.data) {
    for (const t of tasksRes.value.data) {
      const proj = (t as any).projects;
      results.push(makeResult(
        'tarefa',
        t.id,
        t.title,
        '/tarefas',
        proj?.nome ? `Projeto: ${proj.nome}` : undefined,
        statusLabel(t.status),
        statusColor(t.status),
      ));
    }
  }

  // Projetos
  if (projectsRes.status === 'fulfilled' && projectsRes.value.data) {
    for (const p of projectsRes.value.data) {
      results.push(makeResult(
        'projeto',
        p.id,
        p.nome,
        '/projetos',
        p.prioridade ? `Prioridade: ${p.prioridade}` : undefined,
        statusLabel(p.status),
        statusColor(p.status),
      ));
    }
  }

  // Sprints
  if (sprintsRes.status === 'fulfilled' && sprintsRes.value.data) {
    for (const s of sprintsRes.value.data) {
      const proj = (s as any).projects;
      results.push(makeResult(
        'sprint',
        s.id,
        s.name,
        '/projetos',
        proj?.nome ? `Projeto: ${proj.nome}` : undefined,
        statusLabel(s.status),
        statusColor(s.status),
      ));
    }
  }

  // Eventos
  if (eventsRes.status === 'fulfilled' && eventsRes.value.data) {
    for (const e of eventsRes.value.data) {
      const dateStr = e.event_date
        ? new Date(e.event_date + 'T00:00:00').toLocaleDateString('pt-BR')
        : '';
      results.push(makeResult(
        'evento',
        e.id,
        e.title,
        '/calendario',
        dateStr ? `Data: ${dateStr}` : undefined,
        e.type ?? undefined,
        'bg-rose-100 text-rose-700',
      ));
    }
  }

  // Conhecimento
  if (knowledgeRes.status === 'fulfilled' && knowledgeRes.value.data) {
    for (const k of knowledgeRes.value.data) {
      results.push(makeResult(
        'conhecimento',
        k.id,
        k.titulo,
        '/conhecimento',
        k.autor ? `Por: ${k.autor}` : undefined,
        k.tags?.[0] ?? undefined,
        'bg-cyan-100 text-cyan-700',
      ));
    }
  }

  // Membros
  if (membersRes.status === 'fulfilled' && membersRes.value.data) {
    for (const m of membersRes.value.data) {
      results.push(makeResult(
        'membro',
        m.id,
        m.nome,
        '/equipe',
        m.departamento ?? m.cargo ?? undefined,
        m.cargo ?? undefined,
        'bg-violet-100 text-violet-700',
      ));
    }
  }

  return results;
}

export { TYPE_CONFIG };
