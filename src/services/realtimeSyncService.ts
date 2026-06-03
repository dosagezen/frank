import { supabase } from '../lib/supabaseClient';
import { invalidateCache, invalidateCacheByPattern, CACHE_KEYS, clearAllCache } from './localCache';
import { clearCache as clearMemoryCache } from './supabaseHelpers';

type RealtimeChannel = ReturnType<typeof supabase.channel>;

let channel: RealtimeChannel | null = null;
let isSubscribed = false;

// Mapa de tabela -> chaves de cache a invalidar
const TABLE_CACHE_MAP: Record<string, string[]> = {
  projects: [
    CACHE_KEYS.PROJECTS, CACHE_KEYS.STATS,
    CACHE_KEYS.PAINEL_PROJECTS, CACHE_KEYS.PAINEL_STATS,
    CACHE_KEYS.TAREFAS_PROJECT_OPTIONS,
  ],
  tasks: [
    CACHE_KEYS.TASKS, CACHE_KEYS.PROJECTS_TASKS, CACHE_KEYS.STATS,
    CACHE_KEYS.PAINEL_TASKS, CACHE_KEYS.PAINEL_STATS,
    CACHE_KEYS.PAINEL_DEADLINES, CACHE_KEYS.PAINEL_ACTIVITY,
  ],
  project_members: [
    CACHE_KEYS.PROJECTS_TEAMS, CACHE_KEYS.PROJECTS, CACHE_KEYS.STATS,
    CACHE_KEYS.PAINEL_PROJECTS, CACHE_KEYS.PAINEL_TEAM,
    CACHE_KEYS.TAREFAS_PROJECT_OPTIONS,
  ],
  project_product_manager: [CACHE_KEYS.PROJECTS_PMS, CACHE_KEYS.PROJECTS],
  project_sprints: [CACHE_KEYS.PROJECTS],
  sprint_tasks: [CACHE_KEYS.PROJECTS],
  project_links: [CACHE_KEYS.PROJECTS],
  project_entregaveis: [CACHE_KEYS.PROJECTS],
  project_sector_contacts: [CACHE_KEYS.PROJECTS],
  sector_contact_persons: [CACHE_KEYS.PROJECTS],
  project_stop_logs: [CACHE_KEYS.PROJECTS],
  profiles: [
    CACHE_KEYS.PROFILES, CACHE_KEYS.TEAM_MEMBERS, CACHE_KEYS.PROJECTS_TEAMS,
    CACHE_KEYS.PAINEL_TEAM, CACHE_KEYS.PAINEL_STATS,
    CACHE_KEYS.EQUIPE_MEMBERS, CACHE_KEYS.ADMIN_USERS,
  ],
  task_comments: [CACHE_KEYS.PAINEL_ACTIVITY],
  notifications: [CACHE_KEYS.NOTIFICACOES_LIST],
  // calendar_events usa invalidação por padrão (chaves dinâmicas)
  calendar_events: [],
};

const WATCHED_TABLES = [
  'projects',
  'tasks',
  'project_members',
  'project_product_manager',
  'profiles',
  'calendar_events',
];

/**
 * Inicia a escuta de mudanças em tempo real no banco.
 * Quando detecta alterações, invalida as chaves de cache correspondentes.
 */
export function startRealtimeSync(): void {
  if (isSubscribed) return;

  channel = supabase.channel('cache-invalidation');

  WATCHED_TABLES.forEach((table) => {
    channel!
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          console.log(`[RealtimeSync] Mudanca em ${table}:`, payload.eventType);
          const keysToInvalidate = TABLE_CACHE_MAP[table] || [];
          if (keysToInvalidate.length > 0) {
            invalidateCache(...keysToInvalidate);
            clearMemoryCache(table);
          }
          // Para calendar_events, invalida todas as chaves com prefixo "calendario-"
          if (table === 'calendar_events') {
            invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX);
          }
          // Para tasks e projects, invalida chaves dinâmicas de relatórios
          if (table === 'tasks' || table === 'projects' || table === 'project_members' || table === 'profiles') {
            invalidateCacheByPattern('relatorios-');
          }
        }
      );
  });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      isSubscribed = true;
      console.log('[RealtimeSync] Conectado - escutando mudancas em:', WATCHED_TABLES.join(', '));
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      isSubscribed = false;
      console.warn('[RealtimeSync] Desconectado, status:', status);
    }
  });
}

/**
 * Para a escuta de mudanças em tempo real.
 */
export function stopRealtimeSync(): void {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
    isSubscribed = false;
    console.log('[RealtimeSync] Desconectado');
  }
}

/**
 * Invalida caches relacionados a projetos (após criar/editar/excluir).
 */
export async function invalidateProjectCaches(): Promise<void> {
  await invalidateCache(
    CACHE_KEYS.PROJECTS,
    CACHE_KEYS.PROJECTS_TEAMS,
    CACHE_KEYS.PROJECTS_PMS,
    CACHE_KEYS.PROJECTS_TASKS,
    CACHE_KEYS.TAREFAS_PROJECT_OPTIONS,
    CACHE_KEYS.STATS
  );
  clearMemoryCache('projects');
  clearMemoryCache('project_members');
  clearMemoryCache('project_product_manager');
  clearMemoryCache('tasks');
}

/**
 * Invalida caches relacionados a tarefas.
 */
export async function invalidateTaskCaches(): Promise<void> {
  await invalidateCache(
    CACHE_KEYS.TASKS,
    CACHE_KEYS.PROJECTS_TASKS,
    CACHE_KEYS.STATS
  );
  clearMemoryCache('tasks');
}

/**
 * Invalida caches relacionados a perfis/equipe.
 */
export async function invalidateProfileCaches(): Promise<void> {
  await invalidateCache(
    CACHE_KEYS.PROFILES,
    CACHE_KEYS.TEAM_MEMBERS,
    CACHE_KEYS.PROJECTS_TEAMS,
    CACHE_KEYS.EQUIPE_MEMBERS,
    CACHE_KEYS.ADMIN_USERS,
  );
  clearMemoryCache('profiles');
}

/**
 * Invalida caches relacionados à listagem de usuários do admin.
 */
export async function invalidateAdminCaches(): Promise<void> {
  await invalidateCache(CACHE_KEYS.ADMIN_USERS);
  clearMemoryCache('profiles');
}

/**
 * Invalida caches relacionados a notificações.
 */
export async function invalidateNotificacoesCaches(): Promise<void> {
  await invalidateCache(CACHE_KEYS.NOTIFICACOES_LIST);
}

/**
 * Invalida caches do calendário (todas as chaves dinâmicas por padrão).
 */
export async function invalidateCalendarioCaches(): Promise<void> {
  await invalidateCacheByPattern(CACHE_KEYS.CALENDARIO_PREFIX);
}

/**
 * Limpa todo o cache (útil no logout).
 */
export async function clearAllCaches(): Promise<void> {
  await clearAllCache();
  clearMemoryCache();
  console.log('[RealtimeSync] Todos os caches limpos');
}
