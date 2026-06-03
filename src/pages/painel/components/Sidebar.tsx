import { useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSidebar } from '../../../contexts/SidebarContext';

interface SidebarProps {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (isCollapsed: boolean) => void;
}

function Sidebar(props: SidebarProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { signOut, isAdmin } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const sidebarContext = useSidebar();

  const isOpen = sidebarContext?.isOpen ?? props.isOpen ?? false;
  const setIsOpen = sidebarContext?.setIsOpen ?? props.setIsOpen ?? (() => {});
  const isCollapsed = sidebarContext?.isCollapsed ?? props.isCollapsed ?? false;
  const setIsCollapsed = sidebarContext?.setIsCollapsed ?? props.setIsCollapsed ?? (() => {});

  const isDark = theme === 'dark';

  // Grupo 1 — Principal
  const group1 = [
    { id: 'painel', label: 'Painel Geral', icon: 'ri-dashboard-line', path: '/painel' },
    { id: 'tarefas', label: 'Tarefas', icon: 'ri-task-line', path: '/tarefas' },
    { id: 'projetos', label: 'Projetos', icon: 'ri-folder-line', path: '/projetos' },
    { id: 'equipe', label: 'Equipe', icon: 'ri-team-line', path: '/equipe' },
  ];

  // Grupo 2 — Gestão e acompanhamento
  const group2 = [
    { id: 'calendario', label: 'Calendário', icon: 'ri-calendar-line', path: '/calendario' },
    { id: 'notificacoes', label: 'Notificações', icon: 'ri-notification-3-line', path: '/notificacoes' },
    { id: 'conhecimento', label: 'Conhecimento', icon: 'ri-book-line', path: '/conhecimento' },
    { id: 'relatorios', label: 'Relatórios', icon: 'ri-file-chart-line', path: '/relatorios' },
  ];

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
      setShowLogoutModal(false);
      navigate('/login', { replace: true });
    } catch {
      setShowLogoutModal(false);
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const NavItem = ({ item }: { item: { id: string; label: string; icon: string; path: string } }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`
          relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer
          ${isActive
            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
          ${isCollapsed ? 'justify-center' : ''}
        `}
        style={{ minHeight: '40px' }}
        title={isCollapsed ? item.label : ''}
        onClick={() => setIsOpen(false)}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-500 rounded-r-full" />
        )}
        <i className={`${item.icon} text-[18px] flex-shrink-0`} />
        {!isCollapsed && (
          <span className="font-medium text-sm">{item.label}</span>
        )}
      </Link>
    );
  };

  const Divider = () => (
    <div className="my-2 mx-3">
      <div className="border-t border-gray-200 dark:border-gray-700 opacity-50" />
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          relative
          fixed lg:static inset-y-0 left-0 z-50
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          flex flex-col transition-all duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'w-[68px]' : 'w-60'}
        `}
      >
        {/* Botão Colapsar — Borda Direita (Desktop) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
            hidden lg:flex items-center justify-center
            absolute right-[-12px] top-5 z-10
            w-6 h-6 rounded-full
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-600
            text-gray-400 dark:text-gray-500
            hover:text-gray-700 dark:hover:text-gray-300
            transition-all cursor-pointer
            opacity-60 hover:opacity-100
            shadow-sm
          `}
          title={isCollapsed ? 'Expandir menu' : 'Colapsar menu'}
        >
          <i className={`ri-arrow-${isCollapsed ? 'right' : 'left'}-s-line text-sm`} />
        </button>

        {/* Logo */}
        <div
          className={`
            px-3 pt-3 pb-3 border-b border-gray-200 dark:border-gray-700
            flex items-center mb-1
            ${isCollapsed ? 'justify-center' : 'justify-between'}
          `}
        >
          <Link
            to="/painel"
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
            onClick={() => setIsOpen(false)}
          >
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
              <img
                src="https://static.readdy.ai/image/a38a5c3741c640eadeac44aae6e6e520/1fe965cd45beaa7952fde5325686f609.png"
                alt="Logo"
                loading="lazy"
                className="h-8"
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1
                  className="text-lg font-bold text-gray-900 dark:text-white truncate leading-tight"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Frank
                </h1>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                  Gestão de Projetos
                </p>
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          {!isCollapsed && (
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden w-7 h-7 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
            >
              <i className="ri-close-line text-lg" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto flex flex-col gap-0.5">

          {/* Grupo 1 — Principal */}
          {group1.map((item) => <NavItem key={item.id} item={item} />)}

          <Divider />

          {/* Grupo 2 — Gestão */}
          {group2.map((item) => <NavItem key={item.id} item={item} />)}

          <Divider />

          {/* Grupo 3 — Sistema */}
          {isAdmin && (
            <Link
              to="/admin"
              className={`
                relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer
                ${location.pathname === '/admin'
                  ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                ${isCollapsed ? 'justify-center' : ''}
              `}
              style={{ minHeight: '40px' }}
              title={isCollapsed ? 'Administração' : ''}
              onClick={() => setIsOpen(false)}
            >
              {location.pathname === '/admin' && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-500 rounded-r-full" />
              )}
              <i className="ri-shield-star-line text-[18px] flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium text-sm">Administração</span>
              )}
            </Link>
          )}

          {/* Sair — último item do Grupo 3 */}
          <button
            onClick={() => {
              setShowLogoutModal(true);
              setIsOpen(false);
            }}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer w-full
              text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
              ${isCollapsed ? 'justify-center' : ''}
            `}
            style={{ minHeight: '40px' }}
            title={isCollapsed ? 'Sair' : ''}
          >
            <i className="ri-logout-box-line text-[18px] flex-shrink-0" />
            {!isCollapsed && (
              <span className="font-medium text-sm">Sair</span>
            )}
          </button>

        </nav>
      </aside>

      {/* Logout Modal — renderizado via Portal no document.body para ficar acima de tudo */}
      {showLogoutModal && createPortal(
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutModal(false);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                  <i className="ri-logout-box-line text-xl text-red-600 dark:text-red-400" />
                </div>
                <h3
                  className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Sair da Conta
                </h3>
              </div>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl sm:text-2xl" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                Tem certeza que deseja sair da sua conta?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full sm:flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full sm:flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loggingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i>
                    Saindo...
                  </span>
                ) : (
                  'Sim, Sair'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default memo(Sidebar);
