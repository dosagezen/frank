
import { useState, useEffect, useCallback } from 'react';

const applyPhoneMask = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const limited = digits.slice(0, 11);
  if (limited.length === 0) return '';
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 7) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}.${limited.slice(7)}`;
};

interface UserProfile {
  id: string;
  nome: string | null;
  email: string | null;
  cargo: string | null;
  telefone: string | null;
  role: string;
  status: string;
  created_at: string | null;
  avatar_url: string | null;
  aniversario: string | null;
}

interface UserTableProps {
  users: UserProfile[];
  currentUserId: string;
  onChangeRole: (userId: string, newRole: string) => void;
  onChangeStatus: (userId: string, newStatus: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  loading: boolean;
  searchQuery: string;
}

const statusOptions = [
  {
    value: 'ativo',
    label: 'Ativo',
    icon: 'ri-checkbox-circle-line',
    badgeBg: 'bg-green-100 dark:bg-green-900/30',
    badgeText: 'text-green-700 dark:text-green-400',
    hoverBg: 'hover:bg-green-50 dark:hover:bg-green-900/20',
  },
  {
    value: 'pendente',
    label: 'Pendente',
    icon: 'ri-time-line',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    badgeText: 'text-amber-700 dark:text-amber-400',
    hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  {
    value: 'inativo',
    label: 'Inativo',
    icon: 'ri-close-circle-line',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
    badgeText: 'text-red-700 dark:text-red-400',
    hoverBg: 'hover:bg-red-50 dark:hover:bg-red-900/20',
  },
];

const roleOptions = [
  {
    value: 'admin',
    label: 'Admin',
    icon: 'ri-shield-star-fill',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/30',
    badgeText: 'text-purple-700 dark:text-purple-400',
    hoverBg: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
  },
  {
    value: 'member',
    label: 'Membro',
    icon: 'ri-user-star-fill',
    badgeBg: 'bg-teal-100 dark:bg-teal-900/30',
    badgeText: 'text-teal-700 dark:text-teal-400',
    hoverBg: 'hover:bg-teal-50 dark:hover:bg-teal-900/20',
  },
];

// Componente isolado para cada dropdown — cada um gerencia seu próprio estado
function StatusDropdown({
  user,
  isSelf,
  onChangeStatus,
}: {
  user: UserProfile;
  isSelf: boolean;
  onChangeStatus: (userId: string, newStatus: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentOpt = statusOptions.find(o => o.value === user.status) || statusOptions[1];

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-status-dropdown="${user.id}"]`)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, user.id]);

  if (isSelf) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${currentOpt.badgeBg} ${currentOpt.badgeText}`}>
        <i className={`${currentOpt.icon} text-[10px]`}></i>
        {currentOpt.label}
      </span>
    );
  }

  const handleSelect = async (value: string) => {
    if (value === user.status || saving) return;
    setOpen(false);
    setSaving(true);
    try {
      await onChangeStatus(user.id, value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" data-status-dropdown={user.id}>
      <button
        type="button"
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
          if (!saving) setOpen(prev => !prev);
        }}
        title="Clique para alterar o status"
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed ${currentOpt.badgeBg} ${currentOpt.badgeText} hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 dark:hover:ring-gray-600 dark:ring-offset-gray-800`}
      >
        {saving ? (
          <i className="ri-loader-4-line animate-spin text-[10px]"></i>
        ) : (
          <i className={`${currentOpt.icon} text-[10px]`}></i>
        )}
        {currentOpt.label}
        {!saving && (
          <i className={`ri-arrow-down-s-line text-[11px] ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`}></i>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-44 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Alterar status</p>
          </div>
          {statusOptions.map(option => {
            const isSelected = user.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${option.hoverBg} ${isSelected ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}
              >
                <span className={`w-6 h-6 flex items-center justify-center rounded-full ${option.badgeBg}`}>
                  <i className={`${option.icon} text-[11px] ${option.badgeText}`}></i>
                </span>
                <span className={`text-xs font-medium flex-1 ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <i className="ri-check-line text-sm text-teal-600 dark:text-teal-400"></i>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Componente isolado para dropdown de papel
function RoleDropdown({
  user,
  isSelf,
  onChangeRole,
}: {
  user: UserProfile;
  isSelf: boolean;
  onChangeRole: (userId: string, newRole: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentOption = roleOptions.find(o => o.value === user.role) || roleOptions[1];

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-role-dropdown="${user.id}"]`)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, user.id]);

  if (isSelf) {
    const opt = roleOptions.find(o => o.value === user.role) || roleOptions[1];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${opt.badgeBg} ${opt.badgeText}`}>
        <i className={`${opt.icon} text-[10px]`}></i>
        {opt.label}
      </span>
    );
  }

  const handleSelect = (value: string) => {
    if (value === user.role || saving) return;
    setOpen(false);
    setSaving(true);
    try {
      onChangeRole(user.id, value);
    } finally {
      // Pequeno delay para feedback visual
      setTimeout(() => setSaving(false), 600);
    }
  };

  return (
    <div className="relative" data-role-dropdown={user.id}>
      <button
        type="button"
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
          if (!saving) setOpen(prev => !prev);
        }}
        title="Clique para alterar o papel"
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed ${currentOption.badgeBg} ${currentOption.badgeText} hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 dark:hover:ring-gray-600 dark:ring-offset-gray-800`}
      >
        {saving ? (
          <i className="ri-loader-4-line animate-spin text-[10px]"></i>
        ) : (
          <i className={`${currentOption.icon} text-[10px]`}></i>
        )}
        {currentOption.label}
        {!saving && (
          <i className={`ri-arrow-down-s-line text-[11px] ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`}></i>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-44 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Alterar papel</p>
          </div>
          {roleOptions.map(option => {
            const isSelected = user.role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors cursor-pointer ${option.hoverBg} ${isSelected ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}
              >
                <span className={`w-6 h-6 flex items-center justify-center rounded-full ${option.badgeBg}`}>
                  <i className={`${option.icon} text-[11px] ${option.badgeText}`}></i>
                </span>
                <span className={`text-xs font-medium flex-1 ${isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <i className="ri-check-line text-sm text-teal-600 dark:text-teal-400"></i>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UserTable({
  users,
  currentUserId,
  onChangeRole,
  onChangeStatus,
  onDeleteUser,
  loading,
  searchQuery,
}: UserTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      (user.nome || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query) ||
      (user.cargo || '').toLowerCase().includes(query) ||
      (user.telefone || '').toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await onDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // error handled by parent
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuário</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cargo / Função</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Telefone</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Papel</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cadastro</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredUsers.map((user) => {
                const isSelf = user.id === currentUserId;
                const isPending = user.status === 'pendente';

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      isPending
                        ? 'bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isPending ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-teal-100 dark:bg-teal-900/30'}`}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" loading="lazy" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <span className={`text-sm font-semibold ${isPending ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400'}`}>
                              {(user.nome || user.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.nome || 'Sem nome'}</p>
                            {isSelf && <span className="text-xs text-gray-400 dark:text-gray-500">(você)</span>}
                            {isPending && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white uppercase tracking-wide">
                                <i className="ri-time-line text-[8px]"></i>
                                Aguardando
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{user.cargo || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {user.telefone ? applyPhoneMask(user.telefone) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusDropdown user={user} isSelf={isSelf} onChangeStatus={onChangeStatus} />
                    </td>
                    <td className="px-5 py-4">
                      <RoleDropdown user={user} isSelf={isSelf} onChangeRole={onChangeRole} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(user.created_at)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isSelf ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">—</span>
                      ) : (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          title="Excluir usuário"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer ml-auto"
                        >
                          <i className="ri-delete-bin-6-line text-base"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mx-auto mb-3">
              <i className="ri-user-search-line text-xl text-gray-400 dark:text-gray-500"></i>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const isPending = user.status === 'pendente';

          return (
            <div
              key={user.id}
              className={`rounded-lg border p-4 ${
                isPending
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isPending ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-teal-100 dark:bg-teal-900/30'}`}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className={`text-sm font-semibold ${isPending ? 'text-amber-600 dark:text-amber-400' : 'text-teal-600 dark:text-teal-400'}`}>
                        {(user.nome || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.nome || 'Sem nome'}</p>
                      {isSelf && <span className="text-xs text-gray-400">(você)</span>}
                      {isPending && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white uppercase tracking-wide">
                          <i className="ri-time-line text-[8px]"></i>
                          Aguardando
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email || '—'}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  <StatusDropdown user={user} isSelf={isSelf} onChangeStatus={onChangeStatus} />
                  <RoleDropdown user={user} isSelf={isSelf} onChangeRole={onChangeRole} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="text-gray-400 dark:text-gray-500">Cargo:</span>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5">{user.cargo || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-gray-500">Telefone:</span>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5">
                    {user.telefone ? applyPhoneMask(user.telefone) : '—'}
                  </p>
                </div>
              </div>

              {!isSelf && (
                <div className="flex items-center justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => setDeleteTarget(user)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-6-line text-sm"></i>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 mx-auto mb-3">
              <i className="ri-user-search-line text-xl text-gray-400 dark:text-gray-500"></i>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => !deleteLoading && setDeleteTarget(null)}></div>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mx-auto mb-4">
                <i className="ri-delete-bin-6-line text-xl text-red-600 dark:text-red-400"></i>
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white text-center mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Excluir usuário
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                Tem certeza que deseja excluir o usuário{' '}
                <strong className="text-gray-900 dark:text-white">{deleteTarget.nome || deleteTarget.email}</strong>?
              </p>
              <p className="text-xs text-red-500 dark:text-red-400 text-center mb-6">
                Esta ação é irreversível. Todos os dados do usuário serão removidos permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <i className="ri-delete-bin-6-line text-sm"></i>
                      Excluir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
