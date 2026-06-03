import { useState, useEffect } from 'react';
import UserAvatar from '../../../components/base/UserAvatar';
import { fetchMemberWithStats, MemberWithStats } from '../../../services/teamService';

interface MemberProfileModalProps {
  memberId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MemberProfileModal({ memberId, isOpen, onClose }: MemberProfileModalProps) {
  const [member, setMember] = useState<MemberWithStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !memberId) return;

    let isMounted = true;
    setLoading(true);
    setMember(null);

    fetchMemberWithStats(memberId).then((data) => {
      if (isMounted) {
        setMember(data);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [isOpen, memberId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = member?.nome || member?.full_name || '';
  const initials = displayName
    ? displayName.trim().split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Perfil do Membro
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Carregando perfil...</p>
            </div>
          ) : !member ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <i className="ri-user-unfollow-line text-4xl text-gray-300 dark:text-gray-600"></i>
              <p className="text-sm text-gray-500 dark:text-gray-400">Perfil não encontrado</p>
            </div>
          ) : (
            <>
              {/* Hero do perfil */}
              <div className="relative">
                {/* Banner */}
                <div className="h-24 bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 rounded-none"></div>

                {/* Avatar sobreposto */}
                <div className="px-6 pb-4">
                  <div className="flex items-end justify-between -mt-10 mb-4">
                    <div className="w-20 h-20 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden flex-shrink-0 shadow-md">
                      <UserAvatar
                        avatarUrl={member.avatar_url}
                        nome={displayName}
                        size="xl"
                        className="w-full h-full"
                      />
                    </div>
                    <span className={`mb-1 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      member.role === 'admin'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                    }`}>
                      {member.role === 'admin' ? (
                        <><i className="ri-shield-star-fill mr-1 text-[10px]"></i>Administrador</>
                      ) : (
                        <><i className="ri-user-line mr-1 text-[10px]"></i>Membro</>
                      )}
                    </span>
                  </div>

                  {/* Nome e cargo */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {displayName || 'Sem nome'}
                  </h3>
                  {member.cargo && (
                    <p className="text-sm text-teal-600 dark:text-teal-400 font-medium mt-0.5">{member.cargo}</p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="px-6 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {member.projetos_count || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Projetos</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {member.tarefas_ativas || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tarefas Ativas</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-teal-600 dark:text-teal-400" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      {member.projetos && member.projetos.length > 0
                        ? `${Math.round((member.projetos_count || 0) * 10)}%`
                        : '—'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Engajamento</div>
                  </div>
                </div>
              </div>

              {/* Informações detalhadas */}
              <div className="px-6 pb-6 space-y-4">

                {/* Bio */}
                {member.bio && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <i className="ri-file-text-line text-teal-500"></i>
                      Sobre
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {member.bio}
                    </p>
                  </div>
                )}

                {/* Contato */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <i className="ri-contacts-line text-teal-500"></i>
                    Contato & Informações
                  </h4>
                  <div className="space-y-2.5">
                    {member.email && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-md bg-teal-100 dark:bg-teal-900/30 flex-shrink-0">
                          <i className="ri-mail-line text-sm text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">Email</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{member.email}</p>
                        </div>
                      </div>
                    )}

                    {member.telefone && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-md bg-teal-100 dark:bg-teal-900/30 flex-shrink-0">
                          <i className="ri-phone-line text-sm text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">Telefone</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{member.telefone}</p>
                        </div>
                      </div>
                    )}

                    {member.localizacao && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-md bg-teal-100 dark:bg-teal-900/30 flex-shrink-0">
                          <i className="ri-map-pin-line text-sm text-teal-600 dark:text-teal-400"></i>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">Localização</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{member.localizacao}</p>
                        </div>
                      </div>
                    )}

                    {member.aniversario && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-md bg-pink-100 dark:bg-pink-900/30 flex-shrink-0">
                          <i className="ri-cake-2-line text-sm text-pink-500 dark:text-pink-400"></i>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">Aniversário</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{member.aniversario}</p>
                        </div>
                      </div>
                    )}

                    {member.created_at && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-600 flex-shrink-0">
                          <i className="ri-calendar-check-line text-sm text-gray-500 dark:text-gray-400"></i>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">Membro desde</p>
                          <p className="text-sm text-gray-800 dark:text-gray-200">
                            {new Date(member.created_at).toLocaleDateString('pt-BR', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Projetos */}
                {member.projetos && member.projetos.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <i className="ri-folder-line text-teal-500"></i>
                      Projetos ({member.projetos.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(member.projetos as { id: string; nome: string }[]).map((projeto) => (
                        <span
                          key={projeto.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-full text-xs text-gray-700 dark:text-gray-300"
                        >
                          <i className="ri-folder-2-line text-teal-500 text-[10px]"></i>
                          {projeto.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
