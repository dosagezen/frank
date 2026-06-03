import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchNotifications,
  generateAutoNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  formatTimeAgo,
  getNotificationMeta,
  getNotificationRoute,
  fetchRelatedItemNames,
  type Notification,
  type RelatedItemInfo,
} from '../../../services/notificationsService';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';

type FilterType = 'all' | 'unread' | 'deadline' | 'overdue' | 'task' | 'comment' | 'project' | 'team' | 'event';

const filterTabs: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: 'Todas', icon: 'ri-apps-line' },
  { key: 'unread', label: 'Não lidas', icon: 'ri-mail-unread-line' },
  { key: 'task', label: 'Tarefas', icon: 'ri-task-line' },
  { key: 'deadline', label: 'Prazos', icon: 'ri-alarm-warning-line' },
  { key: 'overdue', label: 'Atrasados', icon: 'ri-error-warning-line' },
  { key: 'event', label: 'Eventos', icon: 'ri-calendar-event-line' },
  { key: 'comment', label: 'Comentários', icon: 'ri-chat-3-line' },
  { key: 'team', label: 'Equipe', icon: 'ri-team-line' },
];

interface Props {
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
}

export default function NotificationsDropdown({ onClose, onUnreadCountChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [relatedItems, setRelatedItems] = useState<Record<string, RelatedItemInfo>>({});
  const filterBarRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await generateAutoNotifications(user.id);
      const data = await fetchNotifications(user.id);
      setNotifications(data);
      // Fetch related items without blocking UI; ignore errors silently
      fetchRelatedItemNames(data).then(setRelatedItems).catch(() => {});
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  /** Realtime: atualiza lista instantaneamente */
  useRealtimeNotifications({
    userId: user?.id,
    onInsert: useCallback((newNotif) => {
      setNotifications((prev) => {
        // Evita duplicatas
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        const mapped: Notification = {
          ...newNotif,
          actor_nome: undefined,
          actor_avatar: undefined,
        };
        const updated = [mapped, ...prev];
        // Busca info do item relacionado para a nova notificação
        fetchRelatedItemNames([mapped]).then((items) => {
          setRelatedItems((prev) => ({ ...prev, ...items }));
        }).catch(() => {});
        return updated;
      });
    }, []),
    onUpdate: useCallback((updatedNotif) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n
        )
      );
    }, []),
    onDelete: useCallback((old) => {
      setNotifications((prev) => prev.filter((n) => n.id !== old.id));
    }, []),
  });

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  useEffect(() => {
    onUnreadCountChange(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length, unread: unreadCount };
    notifications.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    return counts;
  }, [notifications, unreadCount]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMarkingIds((prev) => new Set(prev).add(id));
    try {
      const ok = await markNotificationAsRead(id);
      if (ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    } finally {
      setMarkingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    setMarkingAll(true);
    try {
      const ok = await markAllNotificationsAsRead(user.id);
      if (ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const ok = await deleteNotification(id);
      if (ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setDeletingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    const route = getNotificationRoute(notification);
    if (route) {
      navigate(route);
      onClose();
    }
  };

  const handleViewAll = () => {
    navigate('/notificacoes');
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-2 w-[520px] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Notificações
          </h3>
          {notifications.some(n => !n.read) && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium cursor-pointer whitespace-nowrap"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div
          ref={filterBarRef}
          className="flex items-center gap-1 px-3 py-2 border-b border-gray-700/60 overflow-x-auto flex-shrink-0 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
        >
          {filterTabs.map((tab) => {
            const count = filterCounts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  filter === tab.key
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                <i className={`${tab.icon} text-[11px]`}></i>
                {tab.label}
                {count > 0 && (
                  <span
                    className={`px-1 rounded text-[9px] font-bold ${
                      filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <i className="ri-loader-4-line animate-spin text-2xl text-teal-500 mb-2"></i>
              <p className="text-xs text-gray-500">Carregando...</p>
            </div>
          )}

          {!loading && filteredNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-800 mb-3">
                <i className="ri-notification-off-line text-xl text-gray-600"></i>
              </div>
              <p className="text-sm font-medium text-gray-400">
                {filter === 'all'
                  ? 'Nenhuma notificação'
                  : `Nenhuma notificação de "${filterTabs.find((t) => t.key === filter)?.label}"`}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {filter === 'all' ? 'Você está em dia!' : 'Tente outro filtro.'}
              </p>
            </div>
          )}

          {filteredNotifications.length > 0 && (
            <div className="py-1">
              {filteredNotifications.map((notification) => {
                const meta = getNotificationMeta(notification.type);
                const isMarking = markingIds.has(notification.id);
                const isDeleting = deletingIds.has(notification.id);
                const route = getNotificationRoute(notification);
                const relatedItem = relatedItems[notification.id];

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-700/30 last:border-0 ${
                      !notification.read
                        ? 'bg-teal-500/5 hover:bg-teal-500/10'
                        : 'hover:bg-gray-800/60'
                    } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                  >
                    {/* Unread indicator */}
                    {!notification.read && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0"></span>
                    )}

                    {/* Icon */}
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5 ${meta.bgColor}`}>
                      <i className={`${meta.icon} text-base ${meta.color}`}></i>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs font-semibold leading-tight truncate ${
                            !notification.read ? 'text-gray-100' : 'text-gray-400'
                          }`}
                        >
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0 mt-0.5">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>

                      <p
                        className={`text-[11px] mt-0.5 leading-relaxed line-clamp-2 ${
                          !notification.read ? 'text-gray-300' : 'text-gray-500'
                        }`}
                      >
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${meta.bgColor} ${meta.color}`}
                        >
                          <i className={`${meta.icon} text-[9px]`}></i>
                          {notification.type === 'deadline'
                            ? 'Prazo'
                            : notification.type === 'overdue'
                            ? 'Atrasado'
                            : notification.type === 'task'
                            ? 'Tarefa'
                            : notification.type === 'comment'
                            ? 'Comentário'
                            : notification.type === 'team'
                            ? 'Equipe'
                            : notification.type === 'event'
                            ? 'Evento'
                            : notification.type === 'project'
                            ? 'Projeto'
                            : notification.type === 'sprint'
                            ? 'Sprint'
                            : notification.type}
                        </span>

                        {relatedItem && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium max-w-[200px] ${relatedItem.bgColor} ${relatedItem.color}`}
                          >
                            <i className={`${relatedItem.icon} text-[9px] flex-shrink-0`}></i>
                            <span className="truncate">{relatedItem.name}</span>
                          </span>
                        )}

                        {route && (
                          <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                            <i className="ri-arrow-right-up-line text-[10px]"></i>
                            Ver
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (hover) */}
                    <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center">
                      {!notification.read && (
                        <button
                          onClick={(e) => handleMarkAsRead(notification.id, e)}
                          disabled={isMarking}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-teal-500/20 transition-colors cursor-pointer disabled:opacity-50"
                          title="Marcar como lida"
                        >
                          {isMarking ? (
                            <i className="ri-loader-4-line animate-spin text-[11px] text-teal-400"></i>
                          ) : (
                            <i className="ri-check-line text-[11px] text-teal-400"></i>
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(notification.id, e)}
                        disabled={isDeleting}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        title="Excluir"
                      >
                        {isDeleting ? (
                          <i className="ri-loader-4-line animate-spin text-[11px] text-red-400"></i>
                        ) : (
                          <i className="ri-delete-bin-line text-[11px] text-red-400"></i>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-700/60 px-4 py-2.5">
          <button
            onClick={handleViewAll}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 hover:bg-teal-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-external-link-line text-xs"></i>
            Ver todas as notificações
          </button>
        </div>
      </div>
    </>
  );
}
