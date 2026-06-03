import { supabase } from '../lib/supabaseClient';
import { safeFetchMany, safeFetchOne } from './supabaseHelpers';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_type: string | null;
  related_id: string | null;
  actor_id: string | null;
  created_at: string;
  actor_nome?: string;
  actor_avatar?: string;
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/send-email-notification`;

// ─── Cooldown persistente via localStorage ───────────────────────────────────
const GENERATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos
const COOLDOWN_KEY = 'notif_last_gen';
const NOTIFICATION_SENT_KEY = 'notif_sent_keys';

function canGenerate(): boolean {
  try {
    const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
    return Date.now() - last >= GENERATION_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markGenerated(): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    // silencioso
  }
}

/** Verifica se uma notificação específica já foi enviada recentemente */
function hasRecentNotification(key: string): boolean {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SENT_KEY);
    if (!stored) return false;
    const sentKeys = JSON.parse(stored) as Record<string, number>;
    const timestamp = sentKeys[key];
    if (!timestamp) return false;
    // Considera "recente" se foi enviada nas últimas 24h
    return Date.now() - timestamp < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Marca uma notificação específica como enviada */
function markNotificationSent(key: string): void {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SENT_KEY);
    const sentKeys = stored ? JSON.parse(stored) : {};
    sentKeys[key] = Date.now();
    localStorage.setItem(NOTIFICATION_SENT_KEY, JSON.stringify(sentKeys));
  } catch {
    // silencioso
  }
}

// ─── E-mail ───────────────────────────────────────────────────────────────────
export async function sendEmailNotification(params: {
  userId: string;
  notificationId?: string;
  type: string;
  title: string;
  message: string;
  recipientEmail: string;
  recipientName: string;
}): Promise<{ success: boolean; reason?: string; error?: string; hint?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { success: false, reason: 'no_session', error: 'Sessão não encontrada. Faça login novamente.' };

    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        userId: params.userId,
        notificationId: params.notificationId || null,
        type: params.type,
        title: params.title,
        message: params.message,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.warn('[sendEmailNotification] HTTP error:', res.status, result);
      return {
        success: false,
        reason: 'request_failed',
        error: result?.error || `Erro HTTP ${res.status}`,
        hint: result?.hint,
      };
    }

    if (!result.success) {
      console.warn('[sendEmailNotification] Falha no envio:', result);
      return {
        success: false,
        reason: result.reason,
        error: result.error,
        hint: result.hint,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[sendEmailNotification] Exceção:', err);
    return { success: false, reason: 'exception', error: err?.message || 'Erro inesperado' };
  }
}

async function triggerEmailForNotification(
  userId: string,
  notificationId: string,
  type: string,
  title: string,
  message: string,
): Promise<void> {
  try {
    const profile = await safeFetchOne(() =>
      supabase
        .from('profiles')
        .select('nome, email, notificacoes_email, email_notificacao')
        .eq('id', userId)
        .maybeSingle()
    );
    if (!profile || !profile.notificacoes_email) return;

    // Usa o email de notificação dedicado; se não houver, usa o email de login
    const destinatario = (profile.email_notificacao || '').trim() || profile.email;
    if (!destinatario) return;

    sendEmailNotification({
      userId,
      notificationId,
      type,
      title,
      message,
      recipientEmail: destinatario,
      recipientName: profile.nome || 'Usuário',
    }).catch(() => {});
  } catch {
    // silencioso
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Verifica se já existe notificação do mesmo tipo/related_id HOJE */
async function notifExistsToday(
  userId: string,
  relatedType: string,
  relatedId: string,
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await safeFetchMany(() =>
    supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('related_type', relatedType)
      .eq('related_id', relatedId)
      .gte('created_at', todayStart.toISOString())
      .limit(1)
  );
  return rows.length > 0;
}

/** Insere notificação e dispara e-mail */
async function insertNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedType: string;
  relatedId: string;
  actorId?: string | null;
}): Promise<void> {
  try {
    const inserted = await safeFetchOne(() =>
      supabase
        .from('notifications')
        .insert({
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          related_type: params.relatedType,
          related_id: params.relatedId,
          actor_id: params.actorId || null,
        })
        .select('id')
        .maybeSingle()
    );
    if (inserted?.id) {
      triggerEmailForNotification(params.userId, inserted.id, params.type, params.title, params.message);
    }
  } catch (err) {
    console.warn('[NOTIF] Erro ao inserir notificação:', err);
  }
}

// ─── Buscar notificações ──────────────────────────────────────────────────────
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  if (!userId) return [];

  const data = await safeFetchMany(() =>
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
  );

  const actorIds = [...new Set(data.filter((n: any) => n.actor_id).map((n: any) => n.actor_id))];
  let actorsMap: Record<string, { nome: string; avatar_url: string | null }> = {};

  if (actorIds.length > 0) {
    const actors = await safeFetchMany(() =>
      supabase.from('profiles').select('id, nome, avatar_url').in('id', actorIds)
    );
    actors.forEach((a: any) => {
      actorsMap[a.id] = { nome: a.nome, avatar_url: a.avatar_url };
    });
  }

  return data.map((n: any) => ({
    ...n,
    actor_nome: n.actor_id ? actorsMap[n.actor_id]?.nome || 'Usuário' : undefined,
    actor_avatar: n.actor_id ? actorsMap[n.actor_id]?.avatar_url || undefined : undefined,
  }));
}

// ─── Buscar apenas contagem de não lidas (leve, sem joins) ────────────────────
export async function fetchUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Gerar notificações automáticas ──────────────────────────────────────────
export async function generateAutoNotifications(userId: string): Promise<void> {
  if (!userId) return;

  if (!canGenerate()) {
    console.log('[AUTO NOTIF] Cooldown ativo, pulando geração');
    return;
  }
  markGenerated();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Projetos compartilhados
  let sharedProjectIds: string[] = [];
  try {
    const memberships = await safeFetchMany(() =>
      supabase.from('project_members').select('project_id').eq('profile_id', userId)
    );
    sharedProjectIds = memberships.map((m: any) => m.project_id);
  } catch { /* continua */ }

  // ── 1. Tarefas com prazo próximo (hoje + 3 dias) ──────────────────────────
  try {
    const ownTasks = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .or(`user_id.eq.${userId},responsavel_id.eq.${userId}`)
        .neq('status', 'feito')
        .gte('due_date', today)
        .lte('due_date', in3Days)
    );

    let sharedTasks: any[] = [];
    if (sharedProjectIds.length > 0) {
      sharedTasks = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, title, due_date, status')
          .in('project_id', sharedProjectIds)
          .neq('status', 'feito')
          .gte('due_date', today)
          .lte('due_date', in3Days)
      ).catch(() => []);
    }

    const taskMap = new Map<string, any>();
    [...ownTasks, ...sharedTasks].forEach((t: any) => { if (!taskMap.has(t.id)) taskMap.set(t.id, t); });

    for (const task of taskMap.values()) {
      const alreadyExists = await notifExistsToday(userId, 'task_deadline', task.id);
      if (alreadyExists) continue;

      const dueDate = new Date(task.due_date + 'T00:00:00');
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const title = diffDays <= 0 ? 'Prazo vencendo hoje!' : 'Prazo próximo';
      const message =
        diffDays <= 0
          ? `A tarefa "${task.title}" vence hoje!`
          : diffDays === 1
          ? `A tarefa "${task.title}" vence amanhã.`
          : `A tarefa "${task.title}" vence em ${diffDays} dias.`;

      await insertNotification({ userId, type: 'deadline', title, message, relatedType: 'task_deadline', relatedId: task.id });
    }
  } catch (err) {
    console.warn('[AUTO NOTIF] Erro tarefas prazo próximo:', err);
  }

  // ── 2. Tarefas atrasadas ──────────────────────────────────────────────────
  try {
    const ownOverdue = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .or(`user_id.eq.${userId},responsavel_id.eq.${userId}`)
        .neq('status', 'feito')
        .lt('due_date', today)
    );

    let sharedOverdue: any[] = [];
    if (sharedProjectIds.length > 0) {
      sharedOverdue = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, title, due_date, status')
          .in('project_id', sharedProjectIds)
          .neq('status', 'feito')
          .lt('due_date', today)
      ).catch(() => []);
    }

    const overdueMap = new Map<string, any>();
    [...ownOverdue, ...sharedOverdue].forEach((t: any) => { if (!overdueMap.has(t.id)) overdueMap.set(t.id, t); });

    for (const task of overdueMap.values()) {
      const alreadyExists = await notifExistsToday(userId, 'task_overdue', task.id);
      if (alreadyExists) continue;

      const dueDate = new Date(task.due_date + 'T00:00:00');
      const diffDays = Math.abs(Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      const title = 'Tarefa atrasada';
      const message = `A tarefa "${task.title}" está atrasada há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}.`;

      await insertNotification({ userId, type: 'overdue', title, message, relatedType: 'task_overdue', relatedId: task.id });
    }
  } catch (err) {
    console.warn('[AUTO NOTIF] Erro tarefas atrasadas:', err);
  }

  // ── 3. Sprints com prazo próximo ──────────────────────────────────────────
  try {
    const ownProjects = await safeFetchMany(() =>
      supabase.from('projects').select('id').eq('user_id', userId)
    ).catch(() => []);
    const allIds = [...new Set([...sharedProjectIds, ...ownProjects.map((p: any) => p.id)])];

    if (allIds.length > 0) {
      // Sprints com prazo próximo
      const sprints = await safeFetchMany(() =>
        supabase
          .from('project_sprints')
          .select('id, name, end_date, status, project_id')
          .in('project_id', allIds)
          .neq('status', 'concluido')
          .gte('end_date', today)
          .lte('end_date', in3Days)
      ).catch(() => []);

      for (const sprint of sprints) {
        const alreadyExists = await notifExistsToday(userId, 'sprint_deadline', sprint.id);
        if (alreadyExists) continue;

        const sprintDate = new Date(sprint.end_date);
        const daysUntil = Math.ceil((sprintDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        await insertNotification({
          userId,
          type: 'sprint',
          title: daysUntil === 0 ? 'Sprint termina hoje!' : `Sprint termina em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`,
          message: `A sprint "${sprint.name}" está próxima do prazo final.`,
          relatedType: 'sprint_deadline',
          relatedId: sprint.project_id,
        });
      }

      // Sprints atrasadas
      const overdueSprints = await safeFetchMany(() =>
        supabase
          .from('project_sprints')
          .select('id, name, end_date, status, project_id')
          .in('project_id', allIds)
          .neq('status', 'concluido')
          .lt('end_date', today)
      ).catch(() => []);

      for (const sprint of overdueSprints) {
        const alreadyExists = await notifExistsToday(userId, 'sprint_overdue', sprint.id);
        if (alreadyExists) continue;

        const sprintDate = new Date(sprint.end_date);
        const daysOverdue = Math.ceil((now.getTime() - sprintDate.getTime()) / (1000 * 60 * 60 * 24));

        await insertNotification({
          userId,
          type: 'sprint',
          title: 'Sprint atrasada',
          message: `A sprint "${sprint.name}" está atrasada há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}.`,
          relatedType: 'sprint_overdue',
          relatedId: sprint.project_id,
        });
      }
    }
  } catch (err) {
    console.warn('[AUTO NOTIF] Erro sprints:', err);
  }

  // ── 4. Projetos com deadline próximo (hoje + 3 dias) ──────────────────────
  try {
    const ownProjects = await safeFetchMany(() =>
      supabase.from('projects').select('id').eq('user_id', userId)
    ).catch(() => []);
    const allProjectIds = [...new Set([...sharedProjectIds, ...ownProjects.map((p: any) => p.id)])];

    if (allProjectIds.length > 0) {
      // Projetos com deadline próximo (não concluídos)
      const projects = await safeFetchMany(() =>
        supabase
          .from('projects')
          .select('id, nome, deadline, prazo')
          .in('id', allProjectIds)
          .is('prazo', null) // Não concluídos (prazo real não preenchido)
          .not('deadline', 'is', null) // Tem deadline definido
          .gte('deadline', today)
          .lte('deadline', in3Days)
      ).catch(() => []);

      for (const project of projects) {
        const alreadyExists = await notifExistsToday(userId, 'project_deadline', project.id);
        if (alreadyExists) continue;

        const deadlineDate = new Date(project.deadline);
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        await insertNotification({
          userId,
          type: 'project',
          title: daysUntil === 0 ? 'Deadline do projeto hoje!' : `Deadline do projeto em ${daysUntil} dia${daysUntil > 1 ? 's' : ''}`,
          message: `O projeto "${project.nome}" tem deadline próximo.`,
          relatedType: 'project_deadline',
          relatedId: project.id,
        });
      }

      // Projetos com deadline vencido (atrasados)
      const overdueProjects = await safeFetchMany(() =>
        supabase
          .from('projects')
          .select('id, nome, deadline, prazo')
          .in('id', allProjectIds)
          .is('prazo', null) // Não concluídos
          .not('deadline', 'is', null)
          .lt('deadline', today)
      ).catch(() => []);

      for (const project of overdueProjects) {
        const alreadyExists = await notifExistsToday(userId, 'project_overdue', project.id);
        if (alreadyExists) continue;

        const deadlineDate = new Date(project.deadline);
        const daysOverdue = Math.ceil((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));

        await insertNotification({
          userId,
          type: 'project',
          title: 'Projeto atrasado',
          message: `O projeto "${project.nome}" está atrasado há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}.`,
          relatedType: 'project_overdue',
          relatedId: project.id,
        });
      }
    }
  } catch (err) {
    console.warn('[AUTO NOTIF] Erro projetos deadline:', err);
  }

  // ── 5. Tarefas recém-atribuídas (últimas 24h) ─────────────────────────────
  try {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const assigned = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, user_id, created_at')
        .eq('responsavel_id', userId)
        .neq('user_id', userId)
        .gte('created_at', yesterday)
    );

    for (const task of assigned) {
      const rows = await safeFetchMany(() =>
        supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('related_type', 'task_assigned')
          .eq('related_id', task.id)
          .limit(1)
      );
      if (rows.length > 0) continue;

      const title = 'Nova tarefa atribuída';
      const message = `Você foi atribuído à tarefa "${task.title}".`;
      await insertNotification({ userId, type: 'task', title, message, relatedType: 'task_assigned', relatedId: task.id, actorId: task.user_id });
    }
  } catch (err) {
    console.warn('[AUTO NOTIF] Erro tarefas atribuídas:', err);
  }

  // ── 6. Eventos de calendário (próximas 24h) ───────────────────────────────
  try {
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const events = await safeFetchMany(() =>
      supabase
        .from('calendar_events')
        .select('id, title, event_date, event_time')
        .eq('user_id', userId)
        .gte('event_date', now.toISOString().split('T')[0])
        .lte('event_date', in24h.split('T')[0])
    ).catch(() => []);

    for (const event of events) {
      const alreadyExists = await notifExistsToday(userId, 'event_reminder', event.id);
      if (!alreadyExists) {
        const title = 'Lembrete de Evento';
        const message = `Evento "${event.title}" acontecerá em breve (${event.event_date} às ${event.event_time}).`;
        await insertNotification({ userId, type: 'event', title, message, relatedType: 'event_reminder', relatedId: event.id });
      }
    }
  } catch (err) {
    console.warn('[AUTO NOTIF] Erro eventos calendário:', err);
  }
}

// ─── Marcar como lida ─────────────────────────────────────────────────────────
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) { console.error('Erro ao marcar como lida:', error); return false; }
  return true;
}

export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) { console.error('Erro ao marcar todas como lidas:', error); return false; }
  return true;
}

// ─── Criar notificação manual ─────────────────────────────────────────────────
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
  actorId?: string;
}): Promise<boolean> {
  if (!params.userId) {
    console.error('[createNotification] ❌ userId vazio, abortando');
    return false;
  }

  console.log('[createNotification] 📤 Enviando notificação para userId:', params.userId.substring(0, 8) + '...');
  console.log('[createNotification] 📋 Dados:', {
    type: params.type,
    title: params.title,
    relatedType: params.relatedType,
    actorId: params.actorId ? params.actorId.substring(0, 8) + '...' : null,
  });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('[createNotification] ❌ Sem sessão ativa');
      return false;
    }

    const EDGE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/create-notification`;

    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedType: params.relatedType || null,
        relatedId: params.relatedId || null,
        actorId: params.actorId || null,
      }),
    });

    const result = await res.json();

    if (!res.ok || !result.success) {
      console.error('[createNotification] ❌ Erro na Edge Function:', result.error || res.statusText);
      return false;
    }

    console.log('[createNotification] ✅ Notificação criada com sucesso! ID:', result.id?.substring(0, 8) + '...');
    return true;
  } catch (err) {
    console.error('[createNotification] 💥 Exceção inesperada:', err);
    return false;
  }
}

// ─── Deletar ──────────────────────────────────────────────────────────────────
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  if (error) { console.error('Erro ao deletar notificação:', error); return false; }
  return true;
}

export async function deleteReadNotifications(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('read', true);
  if (error) { console.error('Erro ao deletar lidas:', error); return false; }
  return true;
}

// ─── Histórico de e-mails ─────────────────────────────────────────────────────
export async function fetchEmailLog(userId: string): Promise<Array<{
  id: string;
  email_type: string;
  subject: string;
  sent_at: string;
  status: string;
}>> {
  if (!userId) return [];
  return safeFetchMany(() =>
    supabase
      .from('email_notifications_log')
      .select('id, email_type, subject, sent_at, status')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(20)
  );
}

// ─── Notificação de mudança de status de tarefa ───────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  fazer: 'Fazer',
  fazendo: 'Fazendo',
  aguardando: 'Aguardando',
  parado: 'Parado',
  feito: 'Feito',
};

const PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'Sem recorrência',
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

/**
 * Notifica o responsável de uma tarefa quando o status é alterado.
 * Não envia notificação se quem alterou é o próprio responsável.
 */
export async function notifyTaskStatusChanged(params: {
  taskId: string;
  taskTitle: string;
  oldStatus: string;
  newStatus: string;
  responsavelId: string;
  actorId: string;
}): Promise<void> {
  const { taskId, taskTitle, oldStatus, newStatus, responsavelId, actorId } = params;

  // Não notificar se o status não mudou ou se quem alterou é o próprio responsável
  if (oldStatus === newStatus || responsavelId === actorId) return;
  if (!responsavelId) return;

  try {
    // Buscar nome de quem alterou
    const actorProfile = await safeFetchOne(() =>
      supabase
        .from('profiles')
        .select('nome')
        .eq('id', actorId)
        .maybeSingle()
    );
    const actorName = actorProfile?.nome || 'Alguém';

    const oldLabel = STATUS_LABELS[oldStatus] || oldStatus;
    const newLabel = STATUS_LABELS[newStatus] || newStatus;

    const title = newStatus === 'feito'
      ? 'Tarefa concluída!'
      : 'Status da tarefa alterado';

    const message = `${actorName} alterou o status da tarefa "${taskTitle}" de "${oldLabel}" para "${newLabel}".`;

    await insertNotification({
      userId: responsavelId,
      type: 'task',
      title,
      message,
      relatedType: 'task_status_changed',
      relatedId: taskId,
      actorId,
    });
  } catch (err) {
    console.warn('[NOTIF] Erro ao notificar mudança de status:', err);
  }
}

/**
 * Notifica o antigo responsável quando uma tarefa é reatribuída para outra pessoa.
 */
export async function notifyTaskReassigned(params: {
  taskId: string;
  taskTitle: string;
  oldResponsavelId: string;
  newResponsavelId: string;
  actorId: string;
}): Promise<void> {
  const { taskId, taskTitle, oldResponsavelId, newResponsavelId, actorId } = params;

  if (oldResponsavelId === newResponsavelId) return;
  if (!oldResponsavelId || !newResponsavelId) return;

  try {
    const [actorProfile, newResponsavelProfile] = await Promise.all([
      safeFetchOne(() =>
        supabase.from('profiles').select('nome').eq('id', actorId).maybeSingle()
      ),
      safeFetchOne(() =>
        supabase.from('profiles').select('nome').eq('id', newResponsavelId).maybeSingle()
      ),
    ]);

    const actorName = actorProfile?.nome || 'Alguém';
    const newResponsavelName = newResponsavelProfile?.nome || 'outro membro';

    // Notificar o antigo responsável que a tarefa foi reatribuída
    if (oldResponsavelId !== actorId) {
      await insertNotification({
        userId: oldResponsavelId,
        type: 'task',
        title: 'Tarefa reatribuída',
        message: `${actorName} reatribuiu a tarefa "${taskTitle}" para ${newResponsavelName}.`,
        relatedType: 'task_reassigned',
        relatedId: taskId,
        actorId,
      });
    }

    // Notificar o novo responsável que recebeu a tarefa
    if (newResponsavelId !== actorId) {
      await insertNotification({
        userId: newResponsavelId,
        type: 'task',
        title: 'Nova tarefa atribuída a você',
        message: `${actorName} atribuiu a tarefa "${taskTitle}" a você.`,
        relatedType: 'task_assigned',
        relatedId: taskId,
        actorId,
      });
    }
  } catch (err) {
    console.warn('[NOTIF] Erro ao notificar reatribuição:', err);
  }
}

/**
 * Interface para representar os dados antigos e novos de uma tarefa.
 * Todos os campos são opcionais — apenas os fornecidos serão comparados.
 */
export interface TaskSnapshot {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  responsavel_id?: string;
  due_date?: string;
  project_id?: string | null;
  sprint_id?: string | null;
  categoria?: string | null;
  tags?: string[] | null;
  tempo_estimado?: string | null;
  recurrence_type?: string;
  recurrence_end_date?: string | null;
  observacoes?: string | null;
  progress?: number;
}

/**
 * Detecta TODAS as alterações entre o estado antigo e novo de uma tarefa
 * e envia notificações apropriadas ao responsável.
 * 
 * Cobre: reatribuição, status, prioridade, prazo, título, descrição,
 * projeto, sprint, categoria, tags, observações, tempo estimado, recorrência, progresso.
 */
export async function notifyTaskFieldsChanged(params: {
  taskId: string;
  taskTitle: string;
  oldData: TaskSnapshot;
  newData: TaskSnapshot;
  responsavelId: string;
  actorId: string;
}): Promise<void> {
  const { taskId, taskTitle, oldData, newData, responsavelId, actorId } = params;

  if (!responsavelId || !actorId) return;

  try {
    // 1. Reatribuição — notifica antigo e novo responsável separadamente
    if (oldData.responsavel_id && newData.responsavel_id && oldData.responsavel_id !== newData.responsavel_id) {
      await notifyTaskReassigned({
        taskId,
        taskTitle: newData.title || taskTitle,
        oldResponsavelId: oldData.responsavel_id,
        newResponsavelId: newData.responsavel_id,
        actorId,
      });
    }

    // 2. Status — usa a função existente dedicada
    if (oldData.status !== undefined && newData.status !== undefined && oldData.status !== newData.status) {
      // Notifica o responsável ATUAL (novo, se mudou)
      const currentResponsavel = newData.responsavel_id || responsavelId;
      await notifyTaskStatusChanged({
        taskId,
        taskTitle: newData.title || taskTitle,
        oldStatus: oldData.status,
        newStatus: newData.status,
        responsavelId: currentResponsavel,
        actorId,
      });
    }

    // 3. Demais campos — notificar o responsável atual sobre cada alteração relevante
    const currentResponsavel = newData.responsavel_id || responsavelId;

    // Se quem alterou é o próprio responsável, não notificar sobre campos gerais
    if (currentResponsavel === actorId) return;

    const changes: string[] = [];

    // Título
    if (oldData.title !== undefined && newData.title !== undefined && oldData.title !== newData.title) {
      changes.push(`Título: "${oldData.title}" → "${newData.title}"`);
    }

    // Descrição
    const oldDesc = (oldData.description || '').trim();
    const newDesc = (newData.description || '').trim();
    if (oldDesc !== newDesc) {
      if (!oldDesc && newDesc) {
        changes.push('Descrição adicionada');
      } else if (oldDesc && !newDesc) {
        changes.push('Descrição removida');
      } else if (oldDesc !== newDesc) {
        changes.push('Descrição alterada');
      }
    }

    // Prioridade
    if (oldData.priority !== undefined && newData.priority !== undefined && oldData.priority !== newData.priority) {
      const oldLabel = PRIORITY_LABELS[oldData.priority] || oldData.priority;
      const newLabel = PRIORITY_LABELS[newData.priority] || newData.priority;
      changes.push(`Prioridade: ${oldLabel} → ${newLabel}`);
    }

    // Prazo
    if (oldData.due_date !== undefined && newData.due_date !== undefined && oldData.due_date !== newData.due_date) {
      const formatDate = (d: string) => {
        try {
          return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
        } catch {
          return d;
        }
      };
      const oldDate = oldData.due_date ? formatDate(oldData.due_date) : 'Sem prazo';
      const newDate = newData.due_date ? formatDate(newData.due_date) : 'Sem prazo';
      changes.push(`Prazo: ${oldDate} → ${newDate}`);
    }

    // Projeto
    if (oldData.project_id !== newData.project_id && (oldData.project_id !== undefined || newData.project_id !== undefined)) {
      const norm = (v: any) => v || null;
      if (norm(oldData.project_id) !== norm(newData.project_id)) {
        changes.push('Projeto alterado');
      }
    }

    // Sprint
    if (oldData.sprint_id !== newData.sprint_id && (oldData.sprint_id !== undefined || newData.sprint_id !== undefined)) {
      const norm = (v: any) => v || null;
      if (norm(oldData.sprint_id) !== norm(newData.sprint_id)) {
        changes.push('Sprint alterada');
      }
    }

    // Categoria
    const oldCat = (oldData.categoria || '').trim();
    const newCat = (newData.categoria || '').trim();
    if (oldCat !== newCat) {
      if (newCat) {
        changes.push(`Categoria: ${oldCat || '(vazio)'} → ${newCat}`);
      } else {
        changes.push('Categoria removida');
      }
    }

    // Tags
    const oldTags = (oldData.tags || []).sort().join(',');
    const newTags = (newData.tags || []).sort().join(',');
    if (oldTags !== newTags) {
      changes.push('Tags alteradas');
    }

    // Tempo estimado
    const oldTempo = (oldData.tempo_estimado || '').trim();
    const newTempo = (newData.tempo_estimado || '').trim();
    if (oldTempo !== newTempo) {
      if (newTempo) {
        changes.push(`Tempo estimado: ${oldTempo || '(vazio)'} → ${newTempo}`);
      } else {
        changes.push('Tempo estimado removido');
      }
    }

    // Recorrência
    if (oldData.recurrence_type !== undefined && newData.recurrence_type !== undefined && oldData.recurrence_type !== newData.recurrence_type) {
      const oldLabel = RECURRENCE_LABELS[oldData.recurrence_type] || oldData.recurrence_type;
      const newLabel = RECURRENCE_LABELS[newData.recurrence_type] || newData.recurrence_type;
      changes.push(`Recorrência: ${oldLabel} → ${newLabel}`);
    }

    // Observações
    const oldObs = (oldData.observacoes || '').trim();
    const newObs = (newData.observacoes || '').trim();
    if (oldObs !== newObs) {
      if (!oldObs && newObs) {
        changes.push('Observações adicionadas');
      } else if (oldObs && !newObs) {
        changes.push('Observações removidas');
      } else {
        changes.push('Observações alteradas');
      }
    }

    // Progresso
    if (oldData.progress !== undefined && newData.progress !== undefined && oldData.progress !== newData.progress) {
      changes.push(`Progresso: ${oldData.progress}% → ${newData.progress}%`);
    }

    // Se não houve mudanças relevantes (além de status e reatribuição já tratados), sair
    if (changes.length === 0) return;

    // Buscar nome de quem alterou
    const actorProfile = await safeFetchOne(() =>
      supabase.from('profiles').select('nome').eq('id', actorId).maybeSingle()
    );
    const actorName = actorProfile?.nome || 'Alguém';

    // Montar mensagem com até 4 alterações listadas
    const displayedChanges = changes.slice(0, 4);
    const remaining = changes.length - displayedChanges.length;
    let message = `${actorName} alterou a tarefa "${newData.title || taskTitle}":\n`;
    message += displayedChanges.map((c) => `• ${c}`).join('\n');
    if (remaining > 0) {
      message += `\n... e mais ${remaining} alteração${remaining > 1 ? 'ões' : ''}.`;
    }

    await insertNotification({
      userId: currentResponsavel,
      type: 'task',
      title: 'Tarefa atualizada',
      message,
      relatedType: 'task_fields_changed',
      relatedId: taskId,
      actorId,
    });
  } catch (err) {
    console.warn('[NOTIF] Erro ao notificar alterações na tarefa:', err);
  }
}

/**
 * Notifica o responsável pela tarefa quando um novo anexo é adicionado.
 * Não envia notificação se quem anexou é o próprio responsável.
 */
export async function notifyTaskAttachmentAdded(params: {
  taskId: string;
  taskTitle: string;
  fileName: string;
  responsavelId: string;
  actorId: string;
}): Promise<void> {
  const { taskId, taskTitle, fileName, responsavelId, actorId } = params;

  // Não notificar se quem anexou é o próprio responsável
  if (!responsavelId || responsavelId === actorId) return;

  try {
    const actorProfile = await safeFetchOne(() =>
      supabase
        .from('profiles')
        .select('nome')
        .eq('id', actorId)
        .maybeSingle()
    );
    const actorName = actorProfile?.nome || 'Alguém';

    await insertNotification({
      userId: responsavelId,
      type: 'task',
      title: 'Novo anexo na tarefa',
      message: `${actorName} adicionou o arquivo "${fileName}" à tarefa "${taskTitle}".`,
      relatedType: 'task_attachment',
      relatedId: taskId,
      actorId,
    });
  } catch (err) {
    console.warn('[NOTIF] Erro ao notificar novo anexo:', err);
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────
export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Agora mesmo';
  if (diffMin < 60) return `${diffMin} min atrás`;
  if (diffHour < 24) return `${diffHour}h atrás`;
  if (diffDay === 1) return 'Ontem';
  if (diffDay < 7) return `${diffDay} dias atrás`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} sem atrás`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function getNotificationMeta(type: string): { icon: string; color: string; bgColor: string } {
  switch (type) {
    case 'task':
      return { icon: 'ri-task-line', color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/30' };
    case 'deadline':
      return { icon: 'ri-alarm-warning-line', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/30' };
    case 'overdue':
      return { icon: 'ri-error-warning-line', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30' };
    case 'comment':
      return { icon: 'ri-chat-3-line', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-50 dark:bg-sky-900/30' };
    case 'project':
      return { icon: 'ri-folder-line', color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30' };
    case 'team':
      return { icon: 'ri-team-line', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' };
    case 'event':
      return { icon: 'ri-calendar-event-line', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-900/30' };
    case 'sprint':
      return { icon: 'ri-speed-line', color: 'text-fuchsia-600 dark:text-fuchsia-400', bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/30' };
    default:
      return { icon: 'ri-notification-3-line', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-700' };
  }
}

/** Retorna a rota correta para navegar ao clicar na notificação */
export function getNotificationRoute(notification: Notification): string | null {
  const rt = notification.related_type;
  const rid = notification.related_id;

  // Tarefas — abrir modal da tarefa específica
  if (
    rt === 'task_deadline' ||
    rt === 'task_overdue' ||
    rt === 'task_assigned' ||
    rt === 'task_status_changed' ||
    rt === 'task_reassigned' ||
    rt === 'task_fields_changed' ||
    rt === 'task_attachment' ||
    rt === 'task_deadline_approaching'
  ) {
    return rid ? `/tarefas?taskId=${rid}` : '/tarefas';
  }

  // Comentários — abrir modal da tarefa com aba de comentários
  if (rt === 'comment') {
    return rid ? `/tarefas?taskId=${rid}&tab=comments` : '/tarefas';
  }

  // Sprints — abrir projeto na aba de sprints
  if (rt === 'sprint_deadline' || rt === 'sprint_overdue') {
    return rid ? `/projetos?projectId=${rid}&tab=sprints` : '/projetos';
  }

  // Projetos — deadline e atraso
  if (rt === 'project_deadline' || rt === 'project_overdue') {
    return rid ? `/projetos?projectId=${rid}` : '/projetos';
  }

  // Membro adicionado
  if (rt === 'member_added') {
    return rid ? `/projetos?projectId=${rid}` : '/projetos';
  }

  // Eventos de calendário
  if (rt === 'event_reminder') {
    return rid ? `/calendario?eventId=${rid}` : '/calendario';
  }

  // Fallbacks por tipo genérico
  if (notification.type === 'sprint') {
    return rid ? `/projetos?projectId=${rid}&tab=sprints` : '/projetos';
  }
  if (notification.type === 'project') {
    return rid ? `/projetos?projectId=${rid}` : '/projetos';
  }
  if (notification.type === 'team') {
    return '/equipe';
  }
  if (notification.type === 'event') {
    return rid ? `/calendario?eventId=${rid}` : '/calendario';
  }
  if (notification.type === 'task' || notification.type === 'deadline' || notification.type === 'overdue') {
    return rid ? `/tarefas?taskId=${rid}` : '/tarefas';
  }
  if (notification.type === 'comment') {
    return rid ? `/tarefas?taskId=${rid}&tab=comments` : '/tarefas';
  }

  return null;
}

/** Retorna label legível do tipo de notificação */
export function getNotificationTypeLabel(type: string, relatedType?: string | null): string {
  if (relatedType === 'sprint_deadline' || relatedType === 'sprint_overdue') return 'Sprint';
  if (relatedType === 'task_deadline' || relatedType === 'task_overdue' || relatedType === 'task_assigned' || relatedType === 'task_status_changed' || relatedType === 'task_reassigned' || relatedType === 'task_fields_changed') return 'Tarefa';
  if (relatedType === 'event_reminder') return 'Evento';
  if (relatedType === 'member_added') return 'Equipe';
  if (relatedType === 'task_deadline_approaching') return 'Prazo';
  if (relatedType === 'project_deadline' || relatedType === 'project_overdue') return 'Projeto';
  switch (type) {
    case 'deadline': return 'Prazo';
    case 'overdue': return 'Atrasado';
    case 'task': return 'Tarefa';
    case 'comment': return 'Comentário';
    case 'team': return 'Equipe';
    case 'event': return 'Evento';
    case 'project': return 'Projeto';
    case 'sprint': return 'Sprint';
    default: return type;
  }
}

// ─── Buscar nomes dos itens relacionados ─────────────────────────────────────

export interface RelatedItemInfo {
  name: string;
  icon: string;
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Extrai o nome do item relacionado da mensagem da notificação (entre aspas)
 * e complementa com dados do banco quando necessário.
 */
export async function fetchRelatedItemNames(
  notifications: Notification[]
): Promise<Record<string, RelatedItemInfo>> {
  const result: Record<string, RelatedItemInfo> = {};

  // Coletar IDs por tipo para buscar em lote
  const taskIds = new Set<string>();
  const projectIds = new Set<string>();
  const eventIds = new Set<string>();

  for (const n of notifications) {
    if (!n.related_id) continue;
    const rt = n.related_type || '';
    if (
      rt.startsWith('task_') ||
      rt === 'comment' ||
      n.type === 'task' ||
      n.type === 'deadline' ||
      n.type === 'overdue' ||
      n.type === 'comment'
    ) {
      taskIds.add(n.related_id);
    } else if (
      rt === 'sprint_deadline' ||
      rt === 'sprint_overdue' ||
      rt === 'project_deadline' ||
      rt === 'member_added' ||
      n.type === 'project' ||
      n.type === 'sprint'
    ) {
      projectIds.add(n.related_id);
    } else if (rt === 'event_reminder' || n.type === 'event') {
      eventIds.add(n.related_id);
    }
  }

  // Buscar nomes em lote
  const taskNamesMap: Record<string, string> = {};
  const projectNamesMap: Record<string, string> = {};
  const eventNamesMap: Record<string, string> = {};

  try {
    if (taskIds.size > 0) {
      const tasks = await safeFetchMany(() =>
        supabase
          .from('tasks')
          .select('id, title')
          .in('id', Array.from(taskIds))
      );
      tasks.forEach((t: any) => { taskNamesMap[t.id] = t.title; });
    }
  } catch { /* silencioso */ }

  try {
    if (projectIds.size > 0) {
      const projects = await safeFetchMany(() =>
        supabase
          .from('projects')
          .select('id, nome')
          .in('id', Array.from(projectIds))
      );
      projects.forEach((p: any) => { projectNamesMap[p.id] = p.nome; });
    }
  } catch { /* silencioso */ }

  try {
    if (eventIds.size > 0) {
      const events = await safeFetchMany(() =>
        supabase
          .from('calendar_events')
          .select('id, title')
          .in('id', Array.from(eventIds))
      );
      events.forEach((e: any) => { eventNamesMap[e.id] = e.title; });
    }
  } catch { /* silencioso */ }

  // Montar resultado
  for (const n of notifications) {
    if (!n.related_id) continue;
    const rt = n.related_type || '';
    const rid = n.related_id;

    if (
      rt.startsWith('task_') ||
      rt === 'comment' ||
      n.type === 'task' ||
      n.type === 'deadline' ||
      n.type === 'overdue' ||
      n.type === 'comment'
    ) {
      const name = taskNamesMap[rid];
      if (name) {
        result[n.id] = {
          name,
          icon: 'ri-task-line',
          label: 'Tarefa',
          color: 'text-teal-700 dark:text-teal-300',
          bgColor: 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200/60 dark:border-teal-700/40',
        };
      }
    } else if (
      rt === 'sprint_deadline' ||
      rt === 'sprint_overdue' ||
      rt === 'project_deadline' ||
      rt === 'member_added' ||
      n.type === 'project' ||
      n.type === 'sprint'
    ) {
      const name = projectNamesMap[rid];
      if (name) {
        result[n.id] = {
          name,
          icon: 'ri-folder-line',
          label: 'Projeto',
          color: 'text-indigo-700 dark:text-indigo-300',
          bgColor: 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-700/40',
        };
      }
    } else if (rt === 'event_reminder' || n.type === 'event') {
      const name = eventNamesMap[rid];
      if (name) {
        result[n.id] = {
          name,
          icon: 'ri-calendar-event-line',
          label: 'Evento',
          color: 'text-violet-700 dark:text-violet-300',
          bgColor: 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200/60 dark:border-violet-700/40',
        };
      }
    }
  }

  return result;
}

// ─── Verificação proativa de prazos próximos ─────────────────────────────────

const DEADLINE_CHECK_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
const DEADLINE_CHECK_KEY = 'notif_deadline_check_last';

function canCheckDeadlines(): boolean {
  try {
    const last = parseInt(localStorage.getItem(DEADLINE_CHECK_KEY) || '0', 10);
    return Date.now() - last >= DEADLINE_CHECK_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markDeadlineChecked(): void {
  try {
    localStorage.setItem(DEADLINE_CHECK_KEY, String(Date.now()));
  } catch {
    // silencioso
  }
}

/**
 * Verifica tarefas com prazo próximo (hoje e amanhã) e envia notificações
 * ao responsável. Roda com cooldown próprio de 10 minutos para não sobrecarregar.
 * Pode ser chamada de qualquer página (tarefas, painel, etc).
 */
export async function checkUpcomingDeadlineNotifications(userId: string): Promise<void> {
  if (!userId) return;
  if (!canCheckDeadlines()) return;
  markDeadlineChecked();

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Buscar tarefas onde o usuário é responsável, com prazo hoje ou amanhã, não concluídas
    const tasks = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, due_date, status, responsavel_id')
        .eq('responsavel_id', userId)
        .neq('status', 'feito')
        .gte('due_date', today)
        .lte('due_date', tomorrow)
    );

    if (!tasks || tasks.length === 0) return;

    for (const task of tasks) {
      const notifKey = `deadline-approaching-${task.id}-${today}`;

      // Verificar no localStorage se já notificou hoje
      if (hasRecentNotification(notifKey)) continue;

      // Verificar no banco se já existe notificação hoje
      const alreadyExists = await notifExistsToday(userId, 'task_deadline_approaching', task.id);
      if (alreadyExists) {
        markNotificationSent(notifKey);
        continue;
      }

      const dueDate = new Date(task.due_date + 'T00:00:00');
      const diffMs = dueDate.getTime() - new Date(today + 'T00:00:00').getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let title: string;
      let message: string;

      if (diffDays === 0) {
        title = '⚠️ Prazo vencendo hoje!';
        message = `A tarefa "${task.title}" vence hoje. Finalize-a o quanto antes!`;
      } else if (diffDays === 1) {
        title = '📅 Prazo amanhã';
        message = `A tarefa "${task.title}" vence amanhã. Não deixe para a última hora!`;
      } else {
        continue;
      }

      await insertNotification({
        userId,
        type: 'deadline',
        title,
        message,
        relatedType: 'task_deadline_approaching',
        relatedId: task.id,
      });

      markNotificationSent(notifKey);
    }

    // Também verificar tarefas onde o usuário é criador (user_id) mas não responsável
    const creatorTasks = await safeFetchMany(() =>
      supabase
        .from('tasks')
        .select('id, title, due_date, status, responsavel_id, user_id')
        .eq('user_id', userId)
        .neq('responsavel_id', userId)
        .neq('status', 'feito')
        .gte('due_date', today)
        .lte('due_date', tomorrow)
    );

    if (!creatorTasks || creatorTasks.length === 0) return;

    for (const task of creatorTasks) {
      const notifKey = `deadline-creator-${task.id}-${today}`;

      if (hasRecentNotification(notifKey)) continue;

      const alreadyExists = await notifExistsToday(userId, 'task_deadline_approaching', task.id);
      if (alreadyExists) {
        markNotificationSent(notifKey);
        continue;
      }

      const dueDate = new Date(task.due_date + 'T00:00:00');
      const diffMs = dueDate.getTime() - new Date(today + 'T00:00:00').getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let title: string;
      let message: string;

      if (diffDays === 0) {
        title = '⚠️ Tarefa criada por você vence hoje!';
        message = `A tarefa "${task.title}" que você criou vence hoje.`;
      } else if (diffDays === 1) {
        title = '📅 Tarefa criada por você vence amanhã';
        message = `A tarefa "${task.title}" que você criou vence amanhã.`;
      } else {
        continue;
      }

      await insertNotification({
        userId,
        type: 'deadline',
        title,
        message,
        relatedType: 'task_deadline_approaching',
        relatedId: task.id,
      });

      markNotificationSent(notifKey);
    }
  } catch (err) {
    console.warn('[DEADLINE CHECK] Erro ao verificar prazos próximos:', err);
  }
}
