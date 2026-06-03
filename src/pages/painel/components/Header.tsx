
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserProfile } from '../../../contexts/UserProfileContext';
import UserAvatar from '../../../components/base/UserAvatar';
import ProfileModal from './ProfileModal';
import NotificationsDropdown from './NotificationsDropdown';
import GlobalSearchDropdown from './GlobalSearchDropdown';
import { fetchUnreadCount } from '../../../services/notificationsService';
import { useRealtimeNotifications } from '../../../hooks/useRealtimeNotifications';
import { globalSearch, type SearchResult } from '../../../services/globalSearchService';

function Cabecalho() {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Busca global ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      setSearchLoading(false);
      return;
    }

    setShowSearchDropdown(true);
    setSearchLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await globalSearch(val.trim(), user?.id ?? '');
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  };

  const handleCloseSearch = useCallback(() => {
    setShowSearchDropdown(false);
  }, []);

  // Fechar busca ao pressionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Notificações ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const updateCount = async () => {
      try {
        const count = await fetchUnreadCount(user.id);
        setUnreadCount(count);
      } catch {
        setUnreadCount(0);
      }
    };
    updateCount();
    const interval = setInterval(updateCount, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useRealtimeNotifications({
    userId: user?.id,
    onInsert: useCallback((n) => {
      if (!n.read) setUnreadCount((prev) => prev + 1);
    }, []),
    onUpdate: useCallback(() => {
      fetchUnreadCount(user?.id ?? '').then((c) => setUnreadCount(c)).catch(() => {});
    }, [user?.id]),
    onDelete: useCallback(() => {
      fetchUnreadCount(user?.id ?? '').then((c) => setUnreadCount(c)).catch(() => {});
    }, [user?.id]),
  });

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 mb-6">
      <div className="flex items-center justify-between gap-4 px-8">
        {/* Busca Global */}
        <div className="relative flex-1 max-w-[480px]">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Buscar projetos, tarefas, membros..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
              }}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-text"
            />
          </div>

          {/* Dropdown de Resultados */}
          {showSearchDropdown && searchQuery.trim().length >= 2 && (
            <GlobalSearchDropdown
              query={searchQuery}
              results={searchResults}
              loading={searchLoading}
              onClose={handleCloseSearch}
            />
          )}
        </div>

        {/* Ações da Direita */}
        <div className="flex items-center gap-3">
          {/* Notificações */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-notification-3-line text-xl"></i>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown de Notificações */}
            {showNotifications && (
              <NotificationsDropdown
                onClose={() => setShowNotifications(false)}
                onUnreadCountChange={handleUnreadCountChange}
              />
            )}
          </div>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <UserAvatar
              nome={profile?.nome || profile?.full_name || user?.email?.split('@')[0] || 'User'}
              size="md"
              avatarUrl={profile?.avatar_url}
            />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {profile?.nome ||
                  profile?.full_name ||
                  user?.email?.split('@')[0] ||
                  user?.email ||
                  'Usuário'}
              </p>
              <p className="text-xs text-gray-400">{profile?.cargo || profile?.role || 'Membro'}</p>
            </div>
          </button>
        </div>
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </header>
  );
}

export default memo(Cabecalho);
