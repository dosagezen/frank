
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchNotifications,
  generateAutoNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteReadNotifications,
  formatTimeAgo,
  getNotificationMeta,
  getNotificationRoute,
  fetchRelatedItemNames,
  type Notification,
  type RelatedItemInfo,
} from '../../services/notificationsService';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { useCachedData } from '../../hooks/useCachedData';
import { CACHE_KEYS } from '../../services/localCache';

type FilterType = 'all' | 'unread' | 'deadline' | 'overdue' | 'task' | 'comment' | 'project' | 'team' | 'event';

const filterTabs: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'Todas', icon: 'ri-apps-line' },
  { key: 'unread', label: 'Não lidas', icon: 'ri-mail-unread-line' },
  { key: 'deadline', label: 'Prazos', icon: 'ri-alarm-warning-line' },
  { key: 'overdue', label: 'Atrasados', icon: 'ri-error-warning-line' },
  { key: 'task', label: 'Tarefas', icon: 'ri-task-line' },
  { key: 'event', label: 'Eventos', icon: 'ri-calendar-event-line' },
  { key: 'comment', label: 'Comentários', icon: 'ri-chat-3-line' },
  { key: 'team', label: 'Equipe', icon: 'ri-team-line' },
];

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const groups: Record<string, Notification[]> = {
    'Hoje': [],
    'Ontem': [],
    'Esta semana': [],
    'Anteriores': [],
  };

  notifications.forEach((n) => {
    const dateStr = n.created_at.split('T')[0];
    if (dateStr === todayStr) {
      groups['Hoje'].push(n);
    } else if (dateStr === yesterday) {
      groups['Ontem'].push(n);
    } else if (dateStr >= weekAgo) {
      groups['Esta semana'].push(n);
    } else {
      groups['Anteriores'].push(n);
    }
  });

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

// TTL de 2 minutos para notificações (precisam ser relativamente frescas)
const NOTIFICACOES_TTL = 2 * 60 * 1000;

export default function NotificacoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Estado local derivado do cache — permite mutações otimistas sem re-fetch
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingRead, setDeletingRead] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [relatedItems, setRelatedItems] = useState<Record<string, RelatedItemInfo>>({});

  // ─── useCachedData: fetch com cache + SWR ───────────────────────────────────
  const fetchFn = useCallback(async (): Promise<Notification[]> => {
    if (!user?.id) return [];
    await generateAutoNotifications(user.id);
    return fetchNotifications(user.id);
  }, [user?.id]);

  const {
    data: cachedNotifications,
    loading,
    isRevalidating,
    retry,
    invalidate,
  } = useCachedData<Notification[]>(
    CACHE_KEYS.NOTIFICACOES_LIST,
    fetchFn,
    { ttl: NOTIFICACOES_TTL, enabled: !!user?.id }
  );

  // Sincroniza state local com dados do cache
  useEffect(() => {
    if (cachedNotifications) {
      setNotifications(cachedNotifications);
      // Buscar nomes dos itens relacionados em paralelo
      fetchRelatedItemNames(cachedNotifications).then((items) => {
        setRelatedItems(items);
      }).catch(() => {});
    }
  }, [cachedNotifications]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Botão de refresh manual: invalida cache e re-busca
  const handleRefresh = useCallback(() => {
    invalidate();
  }, [invalidate]);

  // ─── Realtime: atualiza state local + invalida cache ────────────────────────
  useRealtimeNotifications({
    userId: user?.id,
    onInsert: useCallback((newNotif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        const mapped: Notification = {
          ...newNotif,
          actor_nome: undefined,
          actor_avatar: undefined,
        };
        fetchRelatedItemNames([mapped]).then((items) => {
          setRelatedItems((prevItems) => ({ ...prevItems, ...items }));
        }).catch(() => {});
        return [mapped, ...prev];
      });
      // Invalida cache para que na próxima visita os dados estejam frescos
      invalidate();
      showToast('Nova notificação recebida!', 'success');
    }, [invalidate]),
    onUpdate: useCallback((updatedNotif) => {
      setNotifications((prev) =>
        prev.map((n) => n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n)
      );
    }, []),
    onDelete: useCallback((old) => {
      setNotifications((prev) => prev.filter((n) => n.id !== old.id));
    }, []),
  });

  // ─── Computed ───────────────────────────────────────────────────────────────
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const grouped = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length, unread: unreadCount };
    notifications.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [notifications, unreadCount]);

  // ─── Mutações (atualizam state local otimisticamente + invalidam cache) ─────
  const handleMarkAsRead = async (id: string) => {
    setMarkingIds((prev) => new Set(prev).add(id));
    try {
      const success = await markNotificationAsRead(id);
      if (success) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        invalidate();
      }
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
      showToast('Erro ao marcar notificação como lida.', 'error');
    } finally {
      setMarkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    setMarkingAll(true);
    try {
      const success = await markAllNotificationsAsRead(user.id);
      if (success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        invalidate();
        showToast('Todas as notificações foram marcadas como lidas.', 'success');
      }
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
      showToast('Erro ao marcar todas as notificações.', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const success = await deleteNotification(id);
      if (success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        invalidate();
      } else {
        showToast('Erro ao excluir notificação.', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      showToast('Erro ao excluir notificação.', 'error');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteAllRead = async () => {
    if (!user?.id) return;
    setDeletingRead(true);
    try {
      const success = await deleteReadNotifications(user.id);
      if (success) {
        setNotifications((prev) => prev.filter((n) => !n.read));
        invalidate();
        showToast(`${readCount} notificações lidas foram excluídas.`, 'success');
      } else {
        showToast('Erro ao excluir notificações.', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir lidas:', err);
      showToast('Erro ao excluir notificações.', 'error');
    } finally {
      setDeletingRead(false);
      setConfirmDeleteAll(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    const route = getNotificationRoute(notification);
    if (route) {
      navigate(route);
    }
  };

  // isLoading = true somente no primeiro acesso (sem cache nenhum)
  const isLoading = loading && notifications.length === 0;

  return (
    <>
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-[60] px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <i className={toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>Notificações</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              Acompanhe prazos, tarefas, eventos e atualizações da equipe
              {isRevalidating && (
                <span className="ml-2 inline-flex items-center gap-1 text-teal-500 dark:text-teal-400">
                  <i className="ri-loader-4-line animate-spin text-xs"></i>
                  <span className="text-xs">atualizando...</span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer flex-shrink-0"
            title="Atualizar"
          >
            <i className={`ri-refresh-line text-lg text-gray-600 dark:text-gray-400 ${isLoading || isRevalidating ? 'animate-spin' : ''}`}></i>
          </button>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 rounded-xl p-4 border border-sky-200 dark:border-sky-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Total</span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <i className="ri-notification-3-line text-sky-600 dark:text-sky-400 text-sm"></i>
              </div>
            </div>
            <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">{notifications.length}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${filter === tab.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'}`}
          >
            <i className={`${tab.icon} text-sm`}></i>
            {tab.label}
            {(filterCounts[tab.key] || 0) > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {filterCounts[tab.key] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {markingAll ? <i className="ri-loader-4-line animate-spin text-sm"></i> : <i className="ri-check-double-line text-sm"></i>}
                Marcar todas como lidas
              </button>
            )}
          </div>
          {readCount > 0 && (
            <div className="relative">
              {!confirmDeleteAll ? (
                <button
                  onClick={() => setConfirmDeleteAll(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line text-sm"></i>Limpar lidas ({readCount})
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">Confirmar exclusão?</span>
                  <button
                    onClick={handleDeleteAllRead}
                    disabled={deletingRead}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {deletingRead ? <i className="ri-loader-4-line animate-spin"></i> : 'Sim'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteAll(false)}
                    className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Não
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading — somente no primeiro acesso sem cache */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <i className="ri-loader-4-line animate-spin text-4xl text-teal-500 mb-3"></i>
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando notificações...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNotifications.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700">
            <i className={`${filter === 'all' ? 'ri-notification-off-line' : filterTabs.find(t => t.key === filter)?.icon || 'ri-notification-off-line'} text-4xl text-gray-300 dark:text-gray-500`}></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {filter === 'all' ? 'Nenhuma notificação' : `Nenhuma notificação de "${filterTabs.find(t => t.key === filter)?.label}"`}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {filter === 'all'
              ? 'Você será notificado automaticamente sobre prazos, tarefas atrasadas, eventos e atualizações da equipe.'
              : 'Tente outro filtro para ver mais notificações.'}
          </p>
        </div>
      )}

      {/* Grouped Notifications */}
      {!isLoading && grouped.map((group) => (
        <div key={group.label} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{group.label}</h3>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{group.items.length}</span>
          </div>
          <div className="space-y-1.5">
            {group.items.map((notification) => {
              const meta = getNotificationMeta(notification.type);
              const isMarking = markingIds.has(notification.id);
              const isDeleting = deletingIds.has(notification.id);
              const route = getNotificationRoute(notification);
              const relatedItem = relatedItems[notification.id];
              return (
                <div
                  key={notification.id}
                  className={`group bg-white dark:bg-gray-800 rounded-xl border transition-all ${!notification.read ? 'border-teal-200 dark:border-teal-800/50 shadow-sm' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'} ${isDeleting ? 'opacity-50 scale-95' : ''}`}
                >
                  <div className="flex gap-3 py-3 px-4 cursor-pointer" onClick={() => handleNotificationClick(notification)}>
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl flex-shrink-0 ${meta.bgColor}`}>
                      <i className={`${meta.icon} text-lg sm:text-xl ${meta.color}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className={`text-sm font-semibold truncate ${!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{notification.title}</h4>
                          {!notification.read && <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0"></span>}
                        </div>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">{formatTimeAgo(notification.created_at)}</span>
                      </div>
                      <p className={`text-sm mb-2 leading-relaxed ${!notification.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}`}>{notification.message}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${meta.bgColor} ${meta.color}`}>
                          <i className={`${meta.icon} text-[10px]`}></i>
                          {notification.type === 'deadline' ? 'Prazo' : notification.type === 'overdue' ? 'Atrasado' : notification.type === 'task' ? 'Tarefa' : notification.type === 'comment' ? 'Comentário' : notification.type === 'team' ? 'Equipe' : notification.type === 'event' ? 'Evento' : notification.type === 'project' ? 'Projeto' : notification.type}
                        </span>
                        {relatedItem && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium max-w-[280px] ${relatedItem.bgColor} ${relatedItem.color}`}>
                            <i className={`${relatedItem.icon} text-[10px] flex-shrink-0`}></i>
                            <span className="truncate">{relatedItem.name}</span>
                          </span>
                        )}
                        {route && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                            <i className="ri-arrow-right-up-line text-xs"></i>Clique para ver
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                          disabled={isMarking}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors cursor-pointer disabled:opacity-50"
                          title="Marcar como lida"
                        >
                          {isMarking ? <i className="ri-loader-4-line animate-spin text-sm text-teal-600 dark:text-teal-400"></i> : <i className="ri-check-line text-sm text-teal-600 dark:text-teal-400"></i>}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}
                        disabled={isDeleting}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer disabled:opacity-50"
                        title="Excluir"
                      >
                        {isDeleting ? <i className="ri-loader-4-line animate-spin text-sm text-red-500"></i> : <i className="ri-delete-bin-line text-sm text-red-500 dark:text-red-400"></i>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
